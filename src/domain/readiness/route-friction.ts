import type { CommuteRoute, DataSource } from "@/domain/models";
export type RouteDetail = "observed" | "estimated" | "demo";
export type SourceConfidence = "high" | "medium" | "low" | "unspecified";
/**
 * Route facts that affect the effort of a journey. This is deliberately not a
 * safety score: it describes only what the selected itinerary exposes.
 */
export interface RouteFrictionProfile {
  routeDetail: RouteDetail;
  walkingMinutes: number | null;
  walkingLegCount: number | null;
  transferCount: number | null;
  oneWayDurationMinutes: number;
  fareConfidence: SourceConfidence;
  routeRetrievedAt: string | null;
}
/**
 * Derives only facts observed by the route provider. A distance-estimated route
 * has synthetic access/wait time, so its zero walk legs or transfers must never
 * be presented as real-world observations.
 */
export function calculateRouteFriction(route: CommuteRoute): RouteFrictionProfile {
  const routeDetail = detailFor(route.sources);
  const routeRetrievedAt =
    route.sources
      .map((source) => source.retrievedAt)
      .filter((retrievedAt): retrievedAt is string => Boolean(retrievedAt))
      .sort()
      .at(-1) ?? null;
  if (routeDetail === "estimated") {
    return {
      routeDetail,
      walkingMinutes: null,
      walkingLegCount: null,
      transferCount: null,
      oneWayDurationMinutes: route.oneWayDurationMinutes,
      fareConfidence: weakestConfidence(route.sources),
      routeRetrievedAt,
    };
  }
  const walkingSegments = route.segments.filter((segment) => segment.mode === "walk");
  return {
    routeDetail,
    walkingMinutes: walkingSegments.reduce(
      (total, segment) => total + segment.estimatedDurationMinutes,
      0,
    ),
    walkingLegCount: walkingSegments.length,
    transferCount: route.transfers,
    oneWayDurationMinutes: route.oneWayDurationMinutes,
    fareConfidence: weakestConfidence(route.sources),
    routeRetrievedAt,
  };
}
function detailFor(sources: readonly DataSource[]): RouteDetail {
  if (sources.some((source) => source.type === "demo")) return "demo";
  if (sources.length > 0 && sources.every((source) => source.type === "estimated")) {
    return "estimated";
  }
  return "observed";
}
function weakestConfidence(sources: readonly DataSource[]): SourceConfidence {
  const ranks: Record<Exclude<SourceConfidence, "unspecified">, number> = {
    low: 0,
    medium: 1,
    high: 2,
  };
  const confidences = sources
    .map((source) => source.confidence)
    .filter((confidence): confidence is Exclude<SourceConfidence, "unspecified"> =>
      Boolean(confidence),
    );
  if (confidences.length === 0) return "unspecified";
  return confidences.reduce((weakest, candidate) =>
    ranks[candidate] < ranks[weakest] ? candidate : weakest,
  );
}
