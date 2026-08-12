import { describe, expect, it } from "vitest";
import type { TransportMode } from "@/domain/models";
import { FARE_DISCOUNT_CLASSES, MANDATED_DISCOUNT_RATE } from "./discount";
import { ROAD_DISTANCE_FACTOR, estimateRoadDistanceKm, priceFare } from "./fare-calculation";
import { FARE_RULES, findFareRule, isFareBearing } from "./fare-matrix";

const FARE_BEARING_MODES: TransportMode[] = [
  "jeepney",
  "bus",
  "rail",
  "uv-express",
  "p2p",
  "tricycle",
  "other",
];

describe("priceFare", () => {
  it("charges the base fare inside the base distance", () => {
    const priced = priceFare({ mode: "jeepney", distanceKm: 3 });
    expect(priced.fare).toBe(13);
    expect(priced.rule?.id).toBe("puj-traditional-in-force");
  });

  it("charges the base fare exactly at the base distance boundary", () => {
    expect(priceFare({ mode: "jeepney", distanceKm: 4 }).fare).toBe(13);
  });

  it("adds the per-kilometre rate beyond the base distance", () => {
    // 13 + (10 - 4) x 1.80 = 23.8, rounded to 24.
    expect(priceFare({ mode: "jeepney", distanceKm: 10 }).fare).toBe(24);
  });

  /**
   * The defect this engine exists to fix: fare used to be a flat per-mode
   * constant, so a short hop and a long haul cost the same.
   */
  it("scales with distance for every fare-bearing mode", () => {
    for (const mode of FARE_BEARING_MODES) {
      const short = priceFare({ mode, distanceKm: 2 });
      const long = priceFare({ mode, distanceKm: 30 });
      expect(long.fare, `${mode} should cost more over 30 km than over 2 km`).toBeGreaterThan(
        short.fare,
      );
    }
  });

  /**
   * The other half of the defect: unrecognised modes returned ₱0, which told
   * users a leg was free. No fare-bearing leg may ever price to zero.
   */
  it("never prices a fare-bearing leg at zero, in any discount class", () => {
    for (const mode of FARE_BEARING_MODES) {
      for (const discount of FARE_DISCOUNT_CLASSES) {
        const priced = priceFare({ mode, distanceKm: 0.4, discount });
        expect(priced.fare, `${mode} at ${discount} rate must not be free`).toBeGreaterThan(0);
        expect(priced.source).not.toBeNull();
      }
    }
  });

  it("treats an unclassified leg as surface transport rather than as free", () => {
    const priced = priceFare({ mode: "other", distanceKm: 6 });
    expect(priced.fare).toBeGreaterThan(0);
    expect(priced.rule?.mode).toBe("other");
    expect(priced.source?.type).toBe("estimated");
  });

  it("prices walking legs at zero and attributes no fare source to them", () => {
    const priced = priceFare({ mode: "walk", distanceKm: 1.5 });
    expect(priced.fare).toBe(0);
    expect(priced.rule).toBeNull();
    expect(priced.source).toBeNull();
    expect(isFareBearing("walk")).toBe(false);
  });

  it("is deterministic", () => {
    const input = { mode: "bus" as const, distanceKm: 12.5, discount: "student" as const };
    expect(priceFare(input)).toEqual(priceFare(input));
  });

  it("rejects an unusable distance", () => {
    expect(() => priceFare({ mode: "bus", distanceKm: -1 })).toThrow(RangeError);
    expect(() => priceFare({ mode: "bus", distanceKm: Number.NaN })).toThrow(RangeError);
  });
});

describe("statutory discounts", () => {
  it("takes 20% off a discountable mode for students, seniors, and PWDs", () => {
    const full = priceFare({ mode: "jeepney", distanceKm: 10 });
    for (const discount of ["student", "senior", "pwd"] as const) {
      const priced = priceFare({ mode: "jeepney", distanceKm: 10, discount });
      expect(priced.undiscountedFare).toBe(full.fare);
      expect(priced.fare).toBe(Math.round(full.fare * (1 - MANDATED_DISCOUNT_RATE)));
      expect(priced.discountAmount).toBe(full.fare - priced.fare);
    }
  });

  it("charges regular passengers the full fare", () => {
    const priced = priceFare({ mode: "jeepney", distanceKm: 10, discount: "regular" });
    expect(priced.discountAmount).toBe(0);
    expect(priced.fare).toBe(priced.undiscountedFare);
  });

  it("does not discount tricycles, which are franchised locally", () => {
    const priced = priceFare({ mode: "tricycle", distanceKm: 3, discount: "student" });
    expect(priced.discountAmount).toBe(0);
    expect(findFareRule("tricycle")?.discountable).toBe(false);
  });
});

describe("fare matrix integrity", () => {
  it("prices at the in-force rate by default, not at a suspended one", () => {
    const priced = priceFare({ mode: "jeepney", distanceKm: 3 });
    expect(priced.rule?.status).toBe("in-force");
    expect(priced.fare).toBe(13);
  });

  it("can price at the approved-but-suspended rate on request", () => {
    const suspended = priceFare({
      mode: "jeepney",
      distanceKm: 3,
      rateStatus: "approved-suspended",
    });
    expect(suspended.rule?.status).toBe("approved-suspended");
    expect(suspended.fare).toBe(14);
  });

  it("falls back to the in-force rate for modes with no pending increase", () => {
    const rule = findFareRule("bus", "approved-suspended");
    expect(rule?.status).toBe("in-force");
  });

  it("never claims an estimated fare is official operator data", () => {
    for (const rule of FARE_RULES) {
      expect(rule.provenance.type, `${rule.id} must not claim official provenance`).not.toBe(
        "official",
      );
    }
  });

  it("exposes exactly one in-force rule per fare-bearing mode", () => {
    for (const mode of FARE_BEARING_MODES) {
      const inForce = FARE_RULES.filter((rule) => rule.mode === mode && rule.status === "in-force");
      expect(inForce, `${mode} needs exactly one in-force rule`).toHaveLength(1);
    }
  });
});

describe("estimateRoadDistanceKm", () => {
  it("inflates straight-line distance by the disclosed detour factor", () => {
    const cubao = { latitude: 14.6195, longitude: 121.0519 };
    const bgc = { latitude: 14.5508, longitude: 121.0501 };
    const straight = estimateRoadDistanceKm(cubao, bgc) / ROAD_DISTANCE_FACTOR;
    expect(estimateRoadDistanceKm(cubao, bgc)).toBeCloseTo(straight * 1.3, 6);
    expect(estimateRoadDistanceKm(cubao, bgc)).toBeGreaterThan(straight);
  });

  it("is zero for identical coordinates", () => {
    const point = { latitude: 14.6, longitude: 121.0 };
    expect(estimateRoadDistanceKm(point, point)).toBe(0);
  });
});
