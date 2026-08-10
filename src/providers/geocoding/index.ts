import { DemoGeocodingProvider } from "./demo-geocoding.provider";
import { FallbackGeocodingProvider } from "./fallback-geocoding.provider";
import type { GeocodingProvider } from "./geocoding-provider";
import { NominatimGeocodingProvider } from "./nominatim.provider";

export { DemoGeocodingProvider } from "./demo-geocoding.provider";
export { FallbackGeocodingProvider } from "./fallback-geocoding.provider";
export { GeocodingProviderError } from "./errors";
export { NominatimGeocodingProvider } from "./nominatim.provider";
export type { GeocodingProvider } from "./geocoding-provider";

let cachedProvider: GeocodingProvider | null = null;

/**
 * Server-side geocoder selection.
 *
 * `GEOCODING_PROVIDER=demo` forces the offline curated geocoder — use it for a
 * network-free rehearsal. Anything else uses Nominatim with an automatic demo
 * fallback so a provider outage degrades instead of breaking the flow.
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

  cachedProvider = new FallbackGeocodingProvider(
    new NominatimGeocodingProvider({
      endpoint: process.env.NOMINATIM_ENDPOINT,
      userAgent: process.env.NOMINATIM_USER_AGENT,
    }),
    demo,
    (reason) => {
      // Reason only. No query text, no coordinates.
      console.warn(`[geocoding] falling back to curated demo geocoder: ${reason}`);
    },
  );

  return cachedProvider;
}

/** Test seam. */
export function resetGeocodingProvider(): void {
  cachedProvider = null;
}
