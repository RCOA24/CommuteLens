import type { Coordinate, Location } from "@/domain/models";
import { GeocodingProviderError } from "./errors";
import type { GeocodingProvider } from "./geocoding-provider";

/**
 * CL-004 — degrades from a live geocoder to the curated demo geocoder.
 *
 * Rationale: a venue network failure must not take down the hero flow. The
 * fallback only triggers on a provider fault, never on a legitimate empty
 * result, so a genuine "no match" is still reported honestly.
 */
export class FallbackGeocodingProvider implements GeocodingProvider {
  constructor(
    private readonly primary: GeocodingProvider,
    private readonly fallback: GeocodingProvider,
    private readonly onFallback: (reason: string) => void = () => {},
  ) {}

  async search(query: string): Promise<Location[]> {
    try {
      return await this.primary.search(query);
    } catch (error) {
      this.report(error);
      return this.fallback.search(query);
    }
  }

  async reverseGeocode(coordinate: Coordinate): Promise<Location | null> {
    try {
      return await this.primary.reverseGeocode(coordinate);
    } catch (error) {
      this.report(error);
      return this.fallback.reverseGeocode(coordinate);
    }
  }

  /** Logs the reason only — never the query, the coordinate, or the response. */
  private report(error: unknown): void {
    this.onFallback(
      error instanceof GeocodingProviderError ? error.reason : "unknown-provider-error",
    );
  }
}
