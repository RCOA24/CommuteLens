import type { CommuteRoute, DataSource, Location } from "@/domain/models";

/**
 * Collapses provider candidates that describe the same normalized itinerary.
 * Provider IDs and retrieval timestamps are intentionally omitted: both may vary
 * between otherwise identical provider responses.
 */
export function deduplicateCommuteRoutes(
  routes: readonly CommuteRoute[],
): CommuteRoute[] {
  const seenSignatures = new Set<string>();

  return routes.filter((route) => {
    const signature = createRouteSignature(route);
    if (seenSignatures.has(signature)) return false;

    seenSignatures.add(signature);
    return true;
  });
}

function createRouteSignature(route: CommuteRoute): string {
  return JSON.stringify({
    oneWayFare: route.oneWayFare,
    oneWayDurationMinutes: route.oneWayDurationMinutes,
    transfers: route.transfers,
    reliability: route.reliability,
    segments: route.segments.map((segment) => ({
      mode: segment.mode,
      origin: createLocationSignature(segment.origin),
      destination: createLocationSignature(segment.destination),
      estimatedFare: segment.estimatedFare,
      estimatedDurationMinutes: segment.estimatedDurationMinutes,
      source: createSourceSignature(segment.source),
    })),
    sources: route.sources.map(createSourceSignature).sort(),
  });
}

function createLocationSignature(location: Location) {
  return {
    label: location.label,
    latitude: location.coordinate.latitude,
    longitude: location.coordinate.longitude,
  };
}

function createSourceSignature(source: DataSource): string {
  return JSON.stringify({
    type: source.type,
    name: source.name,
    sourceUrl: source.sourceUrl ?? null,
    effectiveDate: source.effectiveDate ?? null,
    freshness: source.freshness ?? null,
    confidence: source.confidence ?? null,
  });
}
