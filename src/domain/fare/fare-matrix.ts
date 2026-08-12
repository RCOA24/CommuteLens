import type { DataSourceType, TransportMode } from "@/domain/models";

/**
 * The fare rate table.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS AND IS NOT AUTHORITATIVE HERE
 * ---------------------------------------------------------------------------
 * Only the traditional jeepney rules carry a regulator citation. Every other
 * mode is a Commute Lens *estimated band*: a plausible base-plus-per-kilometre
 * curve chosen to sit near observed Metro Manila fares, and explicitly not a
 * published matrix. Two reasons that distinction is kept in the data rather
 * than in a comment:
 *
 *   1. The resulting `DataSource` differs, so the receipt and the provenance
 *      badge downgrade themselves automatically for estimated modes.
 *   2. Rail is genuinely not distance-linear — LRT/MRT charge by station-pair
 *      matrices — so a band will be wrong at the margins and must say so.
 *
 * Even the jeepney fare is labelled `estimated` rather than `official`: the
 * *rate* is official, but we apply it to an estimated road distance, and an
 * official rate times an estimated distance is still an estimate. Claiming
 * otherwise would be the exact dishonesty this app exists to avoid.
 *
 * ---------------------------------------------------------------------------
 * WHY A RULE CAN BE APPROVED BUT NOT IN FORCE
 * ---------------------------------------------------------------------------
 * In March 2026 the LTFRB approved a fare increase (traditional jeepney base
 * ₱13 → ₱14, succeeding kilometres ₱1.80 → ₱2.00) to take effect 19 March
 * 2026. Implementation was suspended by the President the following day and,
 * as of the date below, remains suspended — so the fare a commuter actually
 * pays is still the ₱13 rate.
 *
 * That is why `status` exists. The engine prices at the in-force rate, and the
 * suspended rate powers the policy simulator: "here is what your commute costs
 * today, and here is what it costs the day the suspension lifts."
 *
 * VERIFY BEFORE ANY DEMO. This is live policy and it has moved twice already.
 */

/** The date these rates were last checked against reporting. */
export const FARE_MATRIX_CHECKED_ON = "2026-08-12";

export type FareRateStatus = "in-force" | "approved-suspended";

export interface FareCitation {
  authority: string;
  reference: string;
  sourceUrl?: string;
  /** One sentence, safe to render verbatim. */
  note: string;
}

export interface FareRuleProvenance {
  type: DataSourceType;
  confidence: "high" | "medium" | "low";
  sourceName: string;
}

export interface FareRule {
  id: string;
  mode: TransportMode;
  /** Human label for the rate, e.g. "Traditional jeepney". */
  label: string;
  /** Fare covering the first `baseDistanceKm` kilometres. */
  baseFare: number;
  baseDistanceKm: number;
  perSucceedingKm: number;
  status: FareRateStatus;
  /** ISO date the rate takes or took effect, when we can source it. */
  effectiveFrom?: string;
  /** Whether the statutory 20% discount applies to this mode. */
  discountable: boolean;
  provenance: FareRuleProvenance;
  citation: FareCitation | null;
}

const LTFRB_CITATION: FareCitation = {
  authority: "LTFRB",
  reference: "Traditional PUJ minimum fare, ₱13 for the first 4 km",
  sourceUrl: "https://ltfrb.gov.ph/",
  note: "The ₱13 minimum jeepney fare is the rate currently in force. A ₱14 increase was approved in March 2026 but its implementation is suspended.",
};

const SUSPENDED_CITATION: FareCitation = {
  authority: "LTFRB",
  reference: "Approved March 2026 increase, suspended before taking effect",
  sourceUrl: "https://ltfrb.gov.ph/",
  note: "Approved to take effect 19 March 2026 (base ₱14, ₱2.00 per succeeding km) and suspended the next day. Commuters are not paying this rate.",
};

/** Applied to modes with no published matrix. Never presented as official. */
const ESTIMATED_BAND: FareRuleProvenance = {
  type: "estimated",
  confidence: "low",
  sourceName: "Commute Lens estimated Metro Manila fare band",
};

/** An official rate applied to an estimated distance: better, but still an estimate. */
const REGULATED_RATE: FareRuleProvenance = {
  type: "estimated",
  confidence: "medium",
  sourceName: "LTFRB jeepney fare matrix applied to an estimated road distance",
};

export const FARE_RULES: readonly FareRule[] = Object.freeze([
  {
    id: "puj-traditional-in-force",
    mode: "jeepney",
    label: "Traditional jeepney",
    baseFare: 13,
    baseDistanceKm: 4,
    perSucceedingKm: 1.8,
    status: "in-force",
    discountable: true,
    provenance: REGULATED_RATE,
    citation: LTFRB_CITATION,
  },
  {
    id: "puj-traditional-approved-suspended",
    mode: "jeepney",
    label: "Traditional jeepney (approved, suspended)",
    baseFare: 14,
    baseDistanceKm: 4,
    perSucceedingKm: 2.0,
    status: "approved-suspended",
    effectiveFrom: "2026-03-19",
    discountable: true,
    provenance: REGULATED_RATE,
    citation: SUSPENDED_CITATION,
  },

  /*
   * Estimated bands below. The approved March 2026 increase also covered buses,
   * UV Express and other PUVs, but we did not verify those figures, so no
   * suspended variant is modelled for them. The policy simulator therefore
   * reports jeepney-class impact only, and says so.
   */
  {
    id: "bus-band",
    mode: "bus",
    label: "City bus",
    baseFare: 15,
    baseDistanceKm: 5,
    perSucceedingKm: 2.8,
    status: "in-force",
    discountable: true,
    provenance: ESTIMATED_BAND,
    citation: null,
  },
  {
    id: "rail-band",
    mode: "rail",
    label: "LRT / MRT",
    baseFare: 14,
    baseDistanceKm: 4,
    perSucceedingKm: 1.6,
    status: "in-force",
    // Rail concessionary fares exist but are administered per operator.
    discountable: true,
    provenance: {
      type: "estimated",
      confidence: "low",
      sourceName: "Commute Lens estimated rail fare band (operators charge by station pair)",
    },
    citation: null,
  },
  {
    id: "uv-express-band",
    mode: "uv-express",
    label: "UV Express",
    baseFare: 15,
    baseDistanceKm: 4,
    perSucceedingKm: 2.5,
    status: "in-force",
    discountable: true,
    provenance: ESTIMATED_BAND,
    citation: null,
  },
  {
    id: "p2p-band",
    mode: "p2p",
    label: "P2P bus",
    baseFare: 70,
    baseDistanceKm: 10,
    perSucceedingKm: 4.5,
    status: "in-force",
    discountable: true,
    provenance: {
      type: "estimated",
      confidence: "low",
      sourceName: "Commute Lens estimated P2P band (operators charge a flat per-route fare)",
    },
    citation: null,
  },
  {
    id: "tricycle-band",
    mode: "tricycle",
    label: "Tricycle",
    baseFare: 30,
    baseDistanceKm: 2,
    perSucceedingKm: 8,
    status: "in-force",
    // Tricycles are franchised by the local government, not the LTFRB, so the
    // national PUV discount mandate does not cleanly apply.
    discountable: false,
    provenance: ESTIMATED_BAND,
    citation: null,
  },
  {
    id: "unclassified-surface-band",
    mode: "other",
    label: "Unclassified surface transport",
    baseFare: 13,
    baseDistanceKm: 4,
    perSucceedingKm: 1.8,
    status: "in-force",
    discountable: true,
    provenance: {
      type: "estimated",
      confidence: "low",
      sourceName: "Commute Lens estimated fare band for an unclassified transport leg",
    },
    citation: null,
  },
  {
    id: "unclassified-surface-approved-suspended",
    mode: "other",
    label: "Unclassified surface transport (approved, suspended)",
    baseFare: 14,
    baseDistanceKm: 4,
    perSucceedingKm: 2.0,
    status: "approved-suspended",
    effectiveFrom: "2026-03-19",
    discountable: true,
    provenance: {
      type: "estimated",
      confidence: "low",
      sourceName: "Commute Lens estimated fare band for an unclassified transport leg",
    },
    citation: SUSPENDED_CITATION,
  },
]);

/** Walking legs carry no fare, so they have no rule. */
export function isFareBearing(mode: TransportMode): boolean {
  return mode !== "walk";
}

/**
 * Finds the rate to price a leg with.
 *
 * Falls back to the in-force rule when a mode has no variant for the requested
 * status, which is what makes the policy simulator safe: an unmodelled mode
 * contributes a zero delta instead of vanishing from the total.
 */
export function findFareRule(
  mode: TransportMode,
  status: FareRateStatus = "in-force",
): FareRule | null {
  if (!isFareBearing(mode)) return null;
  return (
    FARE_RULES.find((rule) => rule.mode === mode && rule.status === status) ??
    FARE_RULES.find((rule) => rule.mode === mode && rule.status === "in-force") ??
    null
  );
}

/** Modes where an approved-but-suspended rate differs from the in-force rate. */
export function modesWithSuspendedIncrease(): TransportMode[] {
  return [
    ...new Set(
      FARE_RULES.filter((rule) => rule.status === "approved-suspended").map((rule) => rule.mode),
    ),
  ];
}
