import { describe, expect, it } from "vitest";
import {
  calculateCommuteBurden,
  calculateEffectiveHourlyValue,
  calculateMonthlyWorkHours,
  estimateTakeHomePay,
} from "./calculations";

describe("finance calculations", () => {
  it("uses the centralized take-home assumption", () => {
    expect(estimateTakeHomePay(45_000)).toBe(40_500);
  });

  it("calculates commute burden from estimated take-home pay", () => {
    expect(calculateCommuteBurden(2_376, 40_200)).toBeCloseTo(5.9104);
  });

  it("includes commute time in effective hourly value", () => {
    const monthlyWorkHours = calculateMonthlyWorkHours(8);
    expect(
      calculateEffectiveHourlyValue({
        incomeAfterCommute: 37_824,
        workingHoursPerDay: 8,
        monthlyCommuteHours: 53.5,
      }),
    ).toBeCloseTo(37_824 / (monthlyWorkHours + 53.5));
  });

  it("rejects invalid authoritative inputs", () => {
    expect(() => estimateTakeHomePay(-1)).toThrow(RangeError);
    expect(() => calculateCommuteBurden(-1, 10_000)).toThrow(RangeError);
    expect(() => calculateMonthlyWorkHours(25)).toThrow(RangeError);
  });
});
