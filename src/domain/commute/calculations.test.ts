import { describe, expect, it } from "vitest";
import { DEMO_ROUTES } from "@/data/demo-routes";
import { calculateCommute } from "./calculations";

describe("calculateCommute", () => {
  it("uses one attendance model for monthly cost and time", () => {
    const result = calculateCommute(DEMO_ROUTES[0], 3);
    expect(result.dailyFare).toBe(86);
    expect(result.monthlyFare).toBeCloseTo(1118);
    expect(result.monthlyMinutes).toBeCloseTo(1560);
  });

  it("returns zero commute values for zero office days", () => {
    expect(calculateCommute(DEMO_ROUTES[0], 0).monthlyFare).toBe(0);
    expect(calculateCommute(DEMO_ROUTES[0], 0).monthlyMinutes).toBe(0);
  });

  it("is deterministic", () => {
    expect(calculateCommute(DEMO_ROUTES[0], 5)).toEqual(calculateCommute(DEMO_ROUTES[0], 5));
  });
});
