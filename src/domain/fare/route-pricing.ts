import { countTransitTransfers } from "@/domain/commute/route-metrics";
import type { CommuteRoute, CommuteSegment, DataSource } from "@/domain/models";
import { describeFareDiscount, fareDiscountRate, type FareDiscountClass } from "./discount";
import { priceLeg } from "./fare-calculation";
import { findFareRule, isFareBearing, type FareRateStatus } from "./fare-matrix";

/**
 * Route-level fare transforms.
 *
 * Both functions rebuild the route's totals from its segments, because
 * `commuteRouteSchema` refuses any route whose `oneWayFare` or `transfers`
 * disagree with its legs. Returning a route that fails its own invariants would
 * be rejected downstream, so the rebuild is not optional.
 */

function withRecalculatedTotals(
  route: CommuteRoute,
  segments: CommuteSegment[],
  extraSources: DataSource[] = [],
): CommuteRoute {
  const sourceByName = new Map<string, DataSource>();
  for (const source of [...segments.map((segment) => segment.source), ...extraSources]) {
    if (!sourceByName.has(source.name)) sourceByName.set(source.name, source);
  }

  return {
    ...route,
    segments,
    oneWayFare: segments.reduce((total, segment) => total + segment.estimatedFare, 0),
    oneWayDurationMinutes: segments.reduce(
      (total, segment) => total + segment.estimatedDurationMinutes,
      0,
    ),
    transfers: countTransitTransfers(segments),
    sources: [...sourceByName.values()],
  };
}

/**
 * Marks a route as already carrying a statutory discount.
 *
 * A route travels from the preview endpoint to the browser and back into the
 * analyze endpoint, so "has this already been discounted?" has to be answerable
 * from the route itself. Without a marker, the second pass would discount an
 * already-discounted fare and under-report the commute by another 20%.
 */
export const FARE_ENTITLEMENT_SOURCE_PREFIX = "Fare entitlement:";

/** The entitlement a route was priced with, or null if it is at full fare. */
export function appliedFareDiscountClass(route: CommuteRoute): FareDiscountClass | null {
  const marker = route.sources.find((source) =>
    source.name.startsWith(FARE_ENTITLEMENT_SOURCE_PREFIX),
  );
  if (!marker) return null;
  for (const candidate of ["student", "senior", "pwd"] as const) {
    if (marker.name.includes(describeFareDiscount(candidate).shortLabel)) return candidate;
  }
  return null;
}

/**
 * Applies a statutory discount to an already-priced route.
 *
 * This runs as a percentage off whatever the provider charged, which is how the
 * entitlement works in practice, and which means it applies uniformly to
 * engine-priced routes and to the hand-curated demo dataset alike. Tricycle
 * legs are skipped because they are franchised locally rather than by the LTFRB.
 *
 * Idempotent: a route that already carries an entitlement marker is returned
 * untouched.
 */
export function applyFareDiscount(
  route: CommuteRoute,
  discountClass: FareDiscountClass,
): CommuteRoute {
  const rate = fareDiscountRate(discountClass);
  if (rate <= 0) return route;
  if (appliedFareDiscountClass(route) !== null) return route;

  let discounted = false;
  const segments = route.segments.map((segment) => {
    if (!isFareBearing(segment.mode) || segment.estimatedFare <= 0) return segment;
    if (findFareRule(segment.mode)?.discountable !== true) return segment;

    discounted = true;
    return {
      ...segment,
      estimatedFare: Math.round(segment.estimatedFare * (1 - rate)),
    };
  });

  if (!discounted) return route;

  const descriptor = describeFareDiscount(discountClass);
  const discountSource: DataSource = {
    type: "official",
    name: `${FARE_ENTITLEMENT_SOURCE_PREFIX} ${descriptor.shortLabel} — ${descriptor.legalBasis ?? "statutory discount"}`,
    confidence: "high",
  };

  return withRecalculatedTotals(route, segments, [discountSource]);
}

/**
 * Re-derives every fare-bearing leg from the fare matrix.
 *
 * Used by the policy simulator, which needs both sides of a comparison to come
 * from the same engine. Comparing an engine-priced route against a curated one
 * would attribute the dataset's own difference to the policy change.
 */
export function repriceRoute(
  route: CommuteRoute,
  options: { discount?: FareDiscountClass; rateStatus?: FareRateStatus } = {},
): CommuteRoute {
  const segments = route.segments.map((segment) => {
    if (!isFareBearing(segment.mode)) return segment;

    const priced = priceLeg({
      mode: segment.mode,
      from: segment.origin.coordinate,
      to: segment.destination.coordinate,
      discount: options.discount,
      rateStatus: options.rateStatus,
    });

    return {
      ...segment,
      estimatedFare: priced.fare,
      source: priced.source ?? segment.source,
    };
  });

  return withRecalculatedTotals(route, segments);
}
