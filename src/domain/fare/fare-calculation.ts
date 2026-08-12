import type { Coordinate, DataSource, TransportMode } from "@/domain/models";
import { distanceKm } from "@/shared/geo/distance";
import { fareDiscountRate, type FareDiscountClass } from "./discount";
import { findFareRule, isFareBearing, type FareRateStatus, type FareRule } from "./fare-matrix";

/**
 * Deterministic fare pricing: fare = f(mode, distance, discount, rate status).
 *
 * This replaces a flat per-mode lookup that charged the same amount for a
 * two-station hop and an end-to-end ride, and that returned ₱0 for any mode it
 * did not recognise. A zero fare is never an acceptable fallback here — it
 * silently tells the user a leg is free, which is the one error this product
 * cannot afford to make.
 */

/**
 * Straight-line distance under-reads road distance. 1.3 is a deliberately
 * conservative Metro Manila detour factor: high enough not to flatter a
 * commute, low enough not to invent cost. It is an assumption, and the UI
 * discloses it.
 */
export const ROAD_DISTANCE_FACTOR = 1.3;

export function estimateRoadDistanceKm(from: Coordinate, to: Coordinate): number {
  return distanceKm(from, to) * ROAD_DISTANCE_FACTOR;
}

export interface FarePricingInput {
  mode: TransportMode;
  /** Road distance in kilometres, not great-circle. */
  distanceKm: number;
  discount?: FareDiscountClass;
  rateStatus?: FareRateStatus;
}

export interface PricedFare {
  /** What the passenger pays, after any statutory discount. */
  fare: number;
  /** The same leg at full published fare. */
  undiscountedFare: number;
  discountAmount: number;
  /** Null for walking legs. */
  rule: FareRule | null;
  /**
   * Provenance for this leg's money. Null for walking legs so the caller keeps
   * its routing source rather than attributing a fare it never charged.
   */
  source: DataSource | null;
}

const FREE_WALK: PricedFare = Object.freeze({
  fare: 0,
  undiscountedFare: 0,
  discountAmount: 0,
  rule: null,
  source: null,
});

function assertUsableDistance(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError("Distance must be a non-negative finite number of kilometres.");
  }
}

function toDataSource(rule: FareRule): DataSource {
  return {
    type: rule.provenance.type,
    name: rule.provenance.sourceName,
    confidence: rule.provenance.confidence,
    ...(rule.citation?.sourceUrl ? { sourceUrl: rule.citation.sourceUrl } : {}),
    ...(rule.effectiveFrom ? { effectiveDate: rule.effectiveFrom } : {}),
  };
}

/**
 * Prices one leg.
 *
 * Rounding happens twice, on purpose: conductors charge whole pesos, and the
 * statutory discount is taken off the fare actually charged rather than off a
 * fractional intermediate.
 */
export function priceFare(input: FarePricingInput): PricedFare {
  if (!isFareBearing(input.mode)) return FREE_WALK;
  assertUsableDistance(input.distanceKm);

  const rule = findFareRule(input.mode, input.rateStatus ?? "in-force");
  if (!rule) return FREE_WALK;

  const beyondBase = Math.max(0, input.distanceKm - rule.baseDistanceKm);
  const undiscountedFare = Math.round(rule.baseFare + beyondBase * rule.perSucceedingKm);

  const rate = rule.discountable ? fareDiscountRate(input.discount ?? "regular") : 0;
  const fare = rate > 0 ? Math.round(undiscountedFare * (1 - rate)) : undiscountedFare;

  return {
    fare,
    undiscountedFare,
    discountAmount: undiscountedFare - fare,
    rule,
    source: toDataSource(rule),
  };
}

/** Convenience wrapper for callers that hold coordinates rather than a distance. */
export function priceLeg(input: {
  mode: TransportMode;
  from: Coordinate;
  to: Coordinate;
  discount?: FareDiscountClass;
  rateStatus?: FareRateStatus;
}): PricedFare {
  return priceFare({
    mode: input.mode,
    distanceKm: estimateRoadDistanceKm(input.from, input.to),
    discount: input.discount,
    rateStatus: input.rateStatus,
  });
}
