import { DemoGeocodingProvider } from "./demo-geocoding.provider";
import { GeoapifyGeocodingProvider } from "./geoapify.provider";
import type { GeocodingProvider } from "./geocoding-provider";
import { NominatimGeocodingProvider } from "./nominatim.provider";

export { DemoGeocodingProvider } from "./demo-geocoding.provider";
export { GeoapifyGeocodingProvider } from "./geoapify.provider";
export { FallbackGeocodingProvider } from "./fallback-geocoding.provider";
export { GeocodingProviderError } from "./errors";
export { NominatimGeocodingProvider } from "./nominatim.provider";
export type { GeocodingProvider } from "./geocoding-provider";

let cachedProvider: GeocodingProvider | null = null;

/**
 * Server-side geocoder selection.
 *
 * `GEOCODING_PROVIDER=demo` forces the offline curated geocoder — use it for a
 * network-free rehearsal. `GEOAPIFY_API_KEY` selects Geoapify for higher-quality
 * location results; `GEOCODING_PROVIDER=nominatim` retains the former adapter.
 *
 * The instance is memoised so its rate limiter and cache are shared across
 * requests in the same server process.
 */
export function getGeocodingProvider(): GeocodingProvider {
  if (cachedProvider) return cachedProvider;

  const demo = new DemoGeocodingProvider();

  if (process.env.GEOCODING_PROVIDER === "demo") {
    cachedProvider = demo;
    return cachedProvider;
  }

  if (process.env.GEOCODING_PROVIDER === "geoapify" || process.env.GEOAPIFY_API_KEY?.trim()) {
    cachedProvider = new GeoapifyGeocodingProvider();
    return cachedProvider;
  }

  cachedProvider = new NominatimGeocodingProvider({
    endpoint: process.env.NOMINATIM_ENDPOINT,
    userAgent: process.env.NOMINATIM_USER_AGENT,
  });

  return cachedProvider;
}

/** Test seam. */
export function resetGeocodingProvider(): void {
  cachedProvider = null;
}
