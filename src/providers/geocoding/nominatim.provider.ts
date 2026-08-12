import { z } from "zod";
import type { Coordinate, Location } from "@/domain/models";
import { TtlCache } from "@/shared/cache/ttl-cache";
import { GeocodingProviderError } from "./errors";
import type { GeocodingProvider } from "./geocoding-provider";

/**
 * CL-004 — Nominatim geocoding adapter.
 *
 * Server-side only. Nominatim's usage policy requires an identifying
 * User-Agent and at most one request per second, so this adapter serialises
 * calls and caches results. Results are biased to the Philippines because the
 * MVP is Philippines-first.
 *
 * Normalisation happens here: callers receive `Location`, never a Nominatim
 * payload. No provider-specific field ever reaches the domain layer.
 */

const DEFAULT_ENDPOINT = "https://nominatim.openstreetmap.org";
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MIN_INTERVAL_MS = 1100;
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RESULTS = 5;
const MIN_QUERY_LENGTH = 3;

/** Rough bounding box for the Philippines: left, top, right, bottom. */
const PH_VIEWBOX = "116.0,21.5,127.0,4.5";

const nominatimPlaceSchema = z.object({
  lat: z.string(),
  lon: z.string(),
  display_name: z.string().trim().min(1),
});

const nominatimSearchSchema = z.array(nominatimPlaceSchema);
const nominatimReverseSchema = z.union([nominatimPlaceSchema, z.object({ error: z.unknown() })]);

function toLocation(place: z.infer<typeof nominatimPlaceSchema>): Location | null {
  const latitude = Number.parseFloat(place.lat);
  const longitude = Number.parseFloat(place.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  return { label: place.display_name, coordinate: { latitude, longitude } };
}

export interface NominatimProviderOptions {
  endpoint?: string;
  /** Required by Nominatim's usage policy. Identify the deployment, not the user. */
  userAgent?: string;
  timeoutMs?: number;
  minIntervalMs?: number;
  cacheTtlMs?: number;
  fetchImpl?: typeof fetch;
}

export class NominatimGeocodingProvider implements GeocodingProvider {
  private readonly endpoint: string;
  private readonly userAgent: string;
  private readonly timeoutMs: number;
  private readonly minIntervalMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly searchCache: TtlCache<Location[]>;
  private readonly reverseCache: TtlCache<Location | null>;

  /** Serialises outbound calls so the rate limit is respected. */
  private queue: Promise<unknown> = Promise.resolve();
  private lastRequestAt = 0;

  constructor(options: NominatimProviderOptions = {}) {
    this.endpoint = (options.endpoint ?? DEFAULT_ENDPOINT).replace(/\/$/, "");
    this.userAgent =
      options.userAgent ??
      "CommuteLens/1.0 (CUTC 2026 prototype; configure NOMINATIM_USER_AGENT with deployment contact)";
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.searchCache = new TtlCache<Location[]>(options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS);
    this.reverseCache = new TtlCache<Location | null>(options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS);
  }

  async search(query: string): Promise<Location[]> {
    const normalizedQuery = query.trim().replace(/\s+/g, " ");
    if (normalizedQuery.length < MIN_QUERY_LENGTH) return [];

    const cacheKey = normalizedQuery.toLowerCase();
    const cached = this.searchCache.get(cacheKey);
    if (cached) return cached;

    const url = new URL(`${this.endpoint}/search`);
    url.searchParams.set("q", normalizedQuery);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "0");
    url.searchParams.set("limit", String(MAX_RESULTS));
    url.searchParams.set("countrycodes", "ph");
    url.searchParams.set("viewbox", PH_VIEWBOX);
    url.searchParams.set("bounded", "1");

    const payload = await this.request(url);
    const parsed = nominatimSearchSchema.safeParse(payload);
    if (!parsed.success) {
      throw new GeocodingProviderError(
        "The geocoder returned an unexpected response.",
        "malformed",
      );
    }

    const locations = parsed.data
      .map(toLocation)
      .filter((location): location is Location => location !== null)
      .slice(0, MAX_RESULTS);

    this.searchCache.set(cacheKey, locations);
    return locations;
  }

  async reverseGeocode(coordinate: Coordinate): Promise<Location | null> {
    // Round to ~100 m for the cache key. Precise user coordinates are used for
    // the request but never persisted as a key or logged.
    const cacheKey = `${coordinate.latitude.toFixed(3)},${coordinate.longitude.toFixed(3)}`;
    const cached = this.reverseCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const url = new URL(`${this.endpoint}/reverse`);
    url.searchParams.set("lat", String(coordinate.latitude));
    url.searchParams.set("lon", String(coordinate.longitude));
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "0");
    url.searchParams.set("zoom", "16");

    const payload = await this.request(url);
    const parsed = nominatimReverseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new GeocodingProviderError(
        "The geocoder returned an unexpected response.",
        "malformed",
      );
    }

    const location = "display_name" in parsed.data ? toLocation(parsed.data) : null;
    this.reverseCache.set(cacheKey, location);
    return location;
  }

  /** Rate-limited, timed-out single request. Never leaks the upstream body. */
  private request(url: URL): Promise<unknown> {
    const run = this.queue.then(async () => {
      const waitMs = this.minIntervalMs - (Date.now() - this.lastRequestAt);
      if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
      this.lastRequestAt = Date.now();

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await this.fetchImpl(url, {
          signal: controller.signal,
          headers: { "User-Agent": this.userAgent, Accept: "application/json" },
        });

        if (!response.ok) {
          throw new GeocodingProviderError(
            "The geocoding service is temporarily unavailable.",
            response.status === 429 ? "rejected" : "upstream",
          );
        }

        return (await response.json()) as unknown;
      } catch (error) {
        if (error instanceof GeocodingProviderError) throw error;
        if (error instanceof Error && error.name === "AbortError") {
          throw new GeocodingProviderError("The geocoding service timed out.", "timeout");
        }
        throw new GeocodingProviderError("The geocoding service is unreachable.", "upstream");
      } finally {
        clearTimeout(timeout);
      }
    });

    // Keep the queue alive even when a request fails.
    this.queue = run.catch(() => undefined);
    return run;
  }
}
