import type { DataSource } from "@/domain/models";
import { TtlCache } from "@/shared/cache/ttl-cache";

const API_BASE_URL = "https://api.mobilitydatabase.org/v1";
const PHILIPPINES = "PH";
const REQUEST_TIMEOUT_MS = 8_000;

interface TokenResponse {
  access_token?: unknown;
}
interface GtfsFeed {
  provider?: unknown;
  status?: unknown;
  latest_dataset?: { hosted_url?: unknown };
}

/** Reads Philippine GTFS catalog metadata without downloading feed archives. */
export class MobilityDatabaseCatalogProvider {
  private readonly refreshToken?: string;
  private readonly fetchImpl: typeof fetch;
  private readonly cache = new TtlCache<DataSource | null>(24 * 60 * 60 * 1000);

  constructor(options: { refreshToken?: string; fetchImpl?: typeof fetch } = {}) {
    this.refreshToken = options.refreshToken ?? process.env.MOBILITY_DATABASE_REFRESH_TOKEN;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getPhilippineGtfsSource(): Promise<DataSource | null> {
    const cached = this.cache.get(PHILIPPINES);
    if (cached !== undefined) return cached;
    if (!this.refreshToken?.trim()) return this.cacheResult(null);
    try {
      const tokenResponse = await this.request(`${API_BASE_URL}/tokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });
      if (!tokenResponse.ok) return this.cacheResult(null);
      const tokenPayload = (await tokenResponse.json()) as TokenResponse;
      const accessToken =
        typeof tokenPayload.access_token === "string" ? tokenPayload.access_token : null;
      if (!accessToken) return this.cacheResult(null);
      const feedsResponse = await this.request(
        `${API_BASE_URL}/gtfs_feeds?country_code=${PHILIPPINES}&limit=1`,
        {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        },
      );
      if (!feedsResponse.ok) return this.cacheResult(null);
      const feeds = (await feedsResponse.json()) as GtfsFeed[];
      const feed = Array.isArray(feeds)
        ? feeds.find((item) => item.status !== "inactive")
        : undefined;
      const provider =
        typeof feed?.provider === "string" && feed.provider.trim()
          ? feed.provider.trim()
          : "Philippine GTFS catalog";
      const datasetUrl =
        typeof feed?.latest_dataset?.hosted_url === "string"
          ? feed.latest_dataset.hosted_url
          : undefined;
      return this.cacheResult({
        type: "gtfs",
        name: `Mobility Database — ${provider}`,
        sourceUrl: datasetUrl ?? "https://mobilitydatabase.org/",
        retrievedAt: new Date().toISOString(),
        confidence: "medium",
      });
    } catch {
      return this.cacheResult(null);
    }
  }

  private cacheResult(source: DataSource | null) {
    this.cache.set(PHILIPPINES, source);
    return source;
  }
  private async request(input: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await this.fetchImpl(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }
}
