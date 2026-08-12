import { z } from "zod";
import type { Coordinate, Location } from "@/domain/models";
import { TtlCache } from "@/shared/cache/ttl-cache";
import { GeocodingProviderError } from "./errors";
import type { GeocodingProvider } from "./geocoding-provider";

const API_BASE_URL = "https://api.geoapify.com/v1/geocode";
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RESULTS = 5;
const MIN_QUERY_LENGTH = 3;

const resultSchema = z.object({
  formatted: z.string().trim().min(1),
  lat: z.number().finite(),
  lon: z.number().finite(),
});
const responseSchema = z.object({ results: z.array(resultSchema) });

export interface GeoapifyGeocodingProviderOptions {
  apiKey?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
  fetchImpl?: typeof fetch;
}

/** Geoapify-backed, Philippines-focused location search and reverse geocoding. */
export class GeoapifyGeocodingProvider implements GeocodingProvider {
  private readonly apiKey?: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly searchCache: TtlCache<Location[]>;
  private readonly reverseCache: TtlCache<Location | null>;

  constructor(options: GeoapifyGeocodingProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.GEOAPIFY_API_KEY;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.searchCache = new TtlCache<Location[]>(options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS);
    this.reverseCache = new TtlCache<Location | null>(options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS);
  }

  async search(query: string): Promise<Location[]> {
    const normalized = query.trim().replace(/\s+/g, " ");
    if (normalized.length < MIN_QUERY_LENGTH) return [];
    const cacheKey = normalized.toLowerCase();
    const cached = this.searchCache.get(cacheKey);
    if (cached) return cached;

    const url = new URL(`${API_BASE_URL}/search`);
    url.searchParams.set("text", normalized);
    url.searchParams.set("filter", "countrycode:ph");
    url.searchParams.set("bias", "countrycode:ph");
    url.searchParams.set("lang", "en");
    url.searchParams.set("limit", String(MAX_RESULTS));
    url.searchParams.set("format", "json");
    const locations = this.toLocations(await this.request(url));
    this.searchCache.set(cacheKey, locations);
    return locations;
  }

  async reverseGeocode(coordinate: Coordinate): Promise<Location | null> {
    const cacheKey = `${coordinate.latitude.toFixed(3)},${coordinate.longitude.toFixed(3)}`;
    const cached = this.reverseCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const url = new URL(`${API_BASE_URL}/reverse`);
    url.searchParams.set("lat", String(coordinate.latitude));
    url.searchParams.set("lon", String(coordinate.longitude));
    url.searchParams.set("filter", "countrycode:ph");
    url.searchParams.set("lang", "en");
    url.searchParams.set("format", "json");
    const location = this.toLocations(await this.request(url))[0] ?? null;
    this.reverseCache.set(cacheKey, location);
    return location;
  }

  private toLocations(payload: unknown): Location[] {
    const parsed = responseSchema.safeParse(payload);
    if (!parsed.success) {
      throw new GeocodingProviderError(
        "The geocoder returned an unexpected response.",
        "malformed",
      );
    }
    return parsed.data.results.slice(0, MAX_RESULTS).map((result) => ({
      label: result.formatted,
      coordinate: { latitude: result.lat, longitude: result.lon },
    }));
  }

  private async request(url: URL): Promise<unknown> {
    if (!this.apiKey?.trim()) {
      throw new GeocodingProviderError("Geoapify is not configured.", "upstream");
    }
    url.searchParams.set("apiKey", this.apiKey);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
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
  }
}
