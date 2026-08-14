import { describe, expect, it } from "vitest";
import { DEMO_ROUTES } from "@/data/demo-routes";
import type { CommuteRoute } from "@/domain/models";
import { deduplicateCommuteRoutes } from "./deduplicate-routes";

function copyRoute(
  route: CommuteRoute,
  overrides: Partial<CommuteRoute> = {},
): CommuteRoute {
  return {
    ...route,
    ...overrides,
    segments: overrides.segments ?? route.segments.map((segment) => ({ ...segment })),
    sources: overrides.sources ?? route.sources.map((source) => ({ ...source })),
  };
}

describe("deduplicateCommuteRoutes", () => {
  it("collapses equivalent routes with different provider IDs and retrieval timestamps", () => {
    const original = DEMO_ROUTES[0];
    const repeated = copyRoute(original, {
      id: "provider-generated-id-2",
      segments: original.segments.map((segment) => ({
        ...segment,
        source: { ...segment.source, retrievedAt: "2026-08-14T10:30:00.000Z" },
      })),
      sources: original.sources.map((source) => ({
        ...source,
        retrievedAt: "2026-08-14T10:30:00.000Z",
      })),
    });

    expect(deduplicateCommuteRoutes([original, repeated])).toEqual([original]);
  });

  it("retains the first provider-ranked occurrence and distinct routes before any cap", () => {
    const routeA = DEMO_ROUTES[0];
    const routeADuplicate = copyRoute(routeA, { id: "duplicate-route-a" });
    const routeB = DEMO_ROUTES[1];

    expect(
      deduplicateCommuteRoutes([routeA, routeADuplicate, routeADuplicate, routeB]),
    ).toEqual([routeA, routeB]);
  });

  it("keeps itineraries with the same totals and modes but different segment locations", () => {
    const original = DEMO_ROUTES[0];
    const differentLeg = copyRoute(original, {
      id: "same-metrics-different-leg",
      segments: original.segments.map((segment, index) =>
        index === 0
          ? {
              ...segment,
              destination: {
                label: "Different interchange",
                coordinate: { latitude: 14.6201, longitude: 121.0541 },
              },
            }
          : segment,
      ),
    });

    expect(deduplicateCommuteRoutes([original, differentLeg])).toEqual([original, differentLeg]);
  });

  it("keeps routes with a meaningful reliability or provenance difference", () => {
    const original = DEMO_ROUTES[0];
    const differentReliability = copyRoute(original, {
      id: "different-reliability",
      reliability: "high",
    });
    const differentProvenance = copyRoute(original, {
      id: "different-provenance",
      sources: original.sources.map((source) => ({ ...source, confidence: "low" })),
    });

    expect(
      deduplicateCommuteRoutes([original, differentReliability, differentProvenance]),
    ).toEqual([original, differentReliability, differentProvenance]);
  });
});
