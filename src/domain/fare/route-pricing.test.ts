import { describe, expect, it } from "vitest";
import { DEMO_ROUTES } from "@/data/demo";
import { commuteRouteSchema } from "@/shared/validation/domain-schemas";
import { estimateSuspendedFareHikeImpact } from "./policy-impact";
import { appliedFareDiscountClass, applyFareDiscount, repriceRoute } from "./route-pricing";

/** A curated route with jeepney, P2P, and no walking legs. */
const alabangBgc = DEMO_ROUTES.find((route) => route.id === "demo-alabang-bgc")!;
/** A curated route that includes a walking leg. */
const cubaoOrtigas = DEMO_ROUTES.find((route) => route.id === "demo-cubao-ortigas")!;

describe("applyFareDiscount", () => {
  it("returns the same route for regular passengers", () => {
    expect(applyFareDiscount(alabangBgc, "regular")).toBe(alabangBgc);
  });

  it("reduces the one-way fare for an entitled passenger", () => {
    const discounted = applyFareDiscount(alabangBgc, "student");
    expect(discounted.oneWayFare).toBeLessThan(alabangBgc.oneWayFare);
    expect(discounted.oneWayFare).toBeGreaterThan(0);
  });

  it("keeps the route valid against its own invariants", () => {
    for (const discount of ["student", "senior", "pwd"] as const) {
      const parsed = commuteRouteSchema.safeParse(applyFareDiscount(alabangBgc, discount));
      expect(parsed.success, `discounted route must stay schema-valid for ${discount}`).toBe(true);
    }
  });

  it("leaves durations and transfers untouched", () => {
    const discounted = applyFareDiscount(alabangBgc, "senior");
    expect(discounted.oneWayDurationMinutes).toBe(alabangBgc.oneWayDurationMinutes);
    expect(discounted.transfers).toBe(alabangBgc.transfers);
    expect(discounted.segments).toHaveLength(alabangBgc.segments.length);
  });

  it("never charges a walking leg", () => {
    const discounted = applyFareDiscount(cubaoOrtigas, "student");
    const walk = discounted.segments.find((segment) => segment.mode === "walk");
    expect(walk?.estimatedFare).toBe(0);
  });

  it("records the legal basis as a route source", () => {
    const discounted = applyFareDiscount(alabangBgc, "pwd");
    const names = discounted.sources.map((source) => source.name).join(" ");
    expect(names).toContain("10754");
  });
});

describe("repriceRoute", () => {
  it("produces a schema-valid route", () => {
    const parsed = commuteRouteSchema.safeParse(repriceRoute(alabangBgc));
    expect(parsed.success).toBe(true);
  });

  it("keeps totals equal to the sum of its legs", () => {
    const repriced = repriceRoute(alabangBgc);
    const summed = repriced.segments.reduce((total, segment) => total + segment.estimatedFare, 0);
    expect(repriced.oneWayFare).toBeCloseTo(summed, 6);
  });

  it("charges every non-walking leg something", () => {
    const repriced = repriceRoute(alabangBgc);
    for (const segment of repriced.segments) {
      if (segment.mode === "walk") continue;
      expect(segment.estimatedFare, `${segment.mode} leg must not be free`).toBeGreaterThan(0);
    }
  });

  it("prices the suspended rate above the in-force rate", () => {
    const inForce = repriceRoute(alabangBgc, { rateStatus: "in-force" });
    const suspended = repriceRoute(alabangBgc, { rateStatus: "approved-suspended" });
    expect(suspended.oneWayFare).toBeGreaterThan(inForce.oneWayFare);
  });
});

describe("estimateSuspendedFareHikeImpact", () => {
  it("reports what the suspended jeepney increase would add each month", () => {
    const impact = estimateSuspendedFareHikeImpact(alabangBgc, 3);
    expect(impact).not.toBeNull();
    if (!impact) return;

    expect(impact.affectedModes).toContain("jeepney");
    expect(impact.oneWayDelta).toBeGreaterThan(0);
    expect(impact.monthlyDelta).toBeGreaterThan(0);
    expect(impact.proposedMonthlyFare).toBeGreaterThan(impact.inForceMonthlyFare);
    expect(impact.proposedEffectiveFrom).toBe("2026-03-19");
    expect(impact.citation.authority).toBe("LTFRB");
  });

  it("scales the monthly impact with office days", () => {
    const twoDays = estimateSuspendedFareHikeImpact(alabangBgc, 2);
    const fourDays = estimateSuspendedFareHikeImpact(alabangBgc, 4);
    expect(twoDays).not.toBeNull();
    expect(fourDays).not.toBeNull();
    if (!twoDays || !fourDays) return;
    expect(fourDays.monthlyDelta).toBeGreaterThan(twoDays.monthlyDelta);
  });

  it("returns nothing for a remote schedule", () => {
    expect(estimateSuspendedFareHikeImpact(alabangBgc, 0)).toBeNull();
  });

  it("returns nothing when no route exists", () => {
    expect(estimateSuspendedFareHikeImpact(null, 3)).toBeNull();
  });

  it("returns nothing for a route with no affected mode", () => {
    // Rail and walking only: no pending increase is modelled for either.
    expect(estimateSuspendedFareHikeImpact(cubaoOrtigas, 5)).toBeNull();
  });

  it("compares like with like, so an entitled passenger sees a smaller impact", () => {
    const regular = estimateSuspendedFareHikeImpact(alabangBgc, 5, "regular");
    const student = estimateSuspendedFareHikeImpact(alabangBgc, 5, "student");
    expect(regular).not.toBeNull();
    expect(student).not.toBeNull();
    if (!regular || !student) return;
    expect(student.inForceMonthlyFare).toBeLessThan(regular.inForceMonthlyFare);
    expect(student.monthlyDelta).toBeLessThanOrEqual(regular.monthlyDelta);
  });
});

describe("fare entitlement idempotence", () => {
  it("does not discount an already-discounted route a second time", () => {
    const once = applyFareDiscount(alabangBgc, "student");
    const twice = applyFareDiscount(once, "student");
    expect(twice).toBe(once);
    expect(twice.oneWayFare).toBe(once.oneWayFare);
  });

  it("reports which entitlement a route was priced with", () => {
    expect(appliedFareDiscountClass(alabangBgc)).toBeNull();
    expect(appliedFareDiscountClass(applyFareDiscount(alabangBgc, "student"))).toBe("student");
    expect(appliedFareDiscountClass(applyFareDiscount(alabangBgc, "senior"))).toBe("senior");
    expect(appliedFareDiscountClass(applyFareDiscount(alabangBgc, "pwd"))).toBe("pwd");
  });

  it("leaves a full-fare route unmarked", () => {
    expect(applyFareDiscount(alabangBgc, "regular")).toBe(alabangBgc);
    expect(appliedFareDiscountClass(applyFareDiscount(alabangBgc, "regular"))).toBeNull();
  });

  /** Applying twice used to compound to 0.64 of the fare rather than 0.8. */
  it("keeps the total at the mandated rate, not the square of it", () => {
    const discounted = applyFareDiscount(applyFareDiscount(alabangBgc, "student"), "student");
    expect(discounted.oneWayFare / alabangBgc.oneWayFare).toBeGreaterThan(0.7);
  });
});
