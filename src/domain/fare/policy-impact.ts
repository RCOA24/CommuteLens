import { calculateCommute } from "@/domain/commute/calculations";
import type { CommuteRoute, TransportMode } from "@/domain/models";
import type { FareDiscountClass } from "./discount";
import {
  FARE_MATRIX_CHECKED_ON,
  FARE_RULES,
  modesWithSuspendedIncrease,
  type FareCitation,
} from "./fare-matrix";
import { repriceRoute } from "./route-pricing";

/**
 * The policy simulator.
 *
 * A fare increase can be approved by the regulator and then never take effect.
 * That is not a hypothetical: the March 2026 jeepney increase was approved and
 * suspended within a day, and commuters are still paying the old rate. A tool
 * that tells you what a job costs should be able to tell you what it will cost
 * if that suspension lifts.
 *
 * Both sides of the comparison are re-priced by the same engine so the delta is
 * attributable to the rate change alone, never to the dataset.
 */

export interface FarePolicyImpact {
  /** Modes whose rate would change. */
  affectedModes: TransportMode[];
  citation: FareCitation;
  /** ISO date the pending rate was approved to take effect. */
  proposedEffectiveFrom?: string;
  /** When these rates were last checked against reporting. */
  ratesCheckedOn: string;
  inForceOneWayFare: number;
  proposedOneWayFare: number;
  oneWayDelta: number;
  inForceMonthlyFare: number;
  proposedMonthlyFare: number;
  monthlyDelta: number;
  onsiteDaysPerWeek: number;
}

/** Below one centavo, two fares are the same fare. */
const TOLERANCE = 0.01;

export function estimateSuspendedFareHikeImpact(
  route: CommuteRoute | null,
  onsiteDaysPerWeek: number,
  discount: FareDiscountClass = "regular",
): FarePolicyImpact | null {
  if (!route || onsiteDaysPerWeek <= 0) return null;

  const affectedModes = modesWithSuspendedIncrease();
  const routeTouchesAffectedMode = route.segments.some((segment) =>
    affectedModes.includes(segment.mode),
  );
  if (!routeTouchesAffectedMode) return null;

  const inForceRoute = repriceRoute(route, { discount, rateStatus: "in-force" });
  const proposedRoute = repriceRoute(route, { discount, rateStatus: "approved-suspended" });

  const oneWayDelta = proposedRoute.oneWayFare - inForceRoute.oneWayFare;
  if (Math.abs(oneWayDelta) < TOLERANCE) return null;

  const inForceMonthly = calculateCommute(inForceRoute, onsiteDaysPerWeek).monthlyFare;
  const proposedMonthly = calculateCommute(proposedRoute, onsiteDaysPerWeek).monthlyFare;

  const suspendedRule = FARE_RULES.find(
    (rule) => rule.status === "approved-suspended" && rule.citation !== null,
  );
  if (!suspendedRule?.citation) return null;

  return {
    affectedModes: [
      ...new Set(
        route.segments
          .map((segment) => segment.mode)
          .filter((mode) => affectedModes.includes(mode)),
      ),
    ],
    citation: suspendedRule.citation,
    proposedEffectiveFrom: suspendedRule.effectiveFrom,
    ratesCheckedOn: FARE_MATRIX_CHECKED_ON,
    inForceOneWayFare: inForceRoute.oneWayFare,
    proposedOneWayFare: proposedRoute.oneWayFare,
    oneWayDelta,
    inForceMonthlyFare: inForceMonthly,
    proposedMonthlyFare: proposedMonthly,
    monthlyDelta: proposedMonthly - inForceMonthly,
    onsiteDaysPerWeek,
  };
}
