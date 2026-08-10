import { DEMO_LOCATIONS } from "@/data/demo";
import type { Coordinate, Location } from "@/domain/models";
import { distanceKm } from "@/shared/geo/distance";
import type { GeocodingProvider } from "./geocoding-provider";

const MAX_RESULTS = 5;
/** Beyond this, reverse geocoding returns null rather than a misleading label. */
const REVERSE_MATCH_RADIUS_KM = 8;

/**
 * CL-004 — offline geocoder over the curated demo locations.
 *
 * Deterministic and network-free, so tests, rehearsals, and a venue with bad
 * wifi all behave identically. It is the fallback whenever the live geocoder is
 * disabled or unreachable.
 */
export class DemoGeocodingProvider implements GeocodingProvider {
  private readonly locations: Location[] = Object.values(DEMO_LOCATIONS);

  async search(query: string): Promise<Location[]> {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return [];

    return (
      this.locations
        .map((location) => ({ location, index: location.label.toLowerCase().indexOf(needle) }))
        .filter((candidate) => candidate.index >= 0)
        // Prefix matches first, then alphabetical so ordering is reproducible.
        .sort(
          (left, right) =>
            left.index - right.index || left.location.label.localeCompare(right.location.label),
        )
        .slice(0, MAX_RESULTS)
        .map((candidate) => candidate.location)
    );
  }

  async reverseGeocode(coordinate: Coordinate): Promise<Location | null> {
    let nearest: { location: Location; km: number } | null = null;

    for (const location of this.locations) {
      const km = distanceKm(location.coordinate, coordinate);
      if (!nearest || km < nearest.km) nearest = { location, km };
    }

    if (!nearest || nearest.km > REVERSE_MATCH_RADIUS_KM) return null;

    // Return the caller's coordinate with the nearest known label so the map pin
    // does not silently jump to a curated point.
    return { label: `Near ${nearest.location.label}`, coordinate };
  }
}
