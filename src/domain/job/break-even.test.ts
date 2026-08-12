import { describe, expect, it } from "vitest";
import {
  calculateRequiredGrossSalary,
  minimumRequiredGrossSalary,
} from "@/domain/finance/calculations";
import type { JobRealityAnalysis } from "@/domain/models";
import { compareJobRealities } from "./comparison";
import { calculateJobBMatchBreakEvenSalary, calculateJobBreakEvenSalary } from "./break-even";

function analysis(input: {
  id: string;
  salary: number;
  rate: number;
  monthlyFare: number;
  incomeAfterCommute: number;
}): JobRealityAnalysis {
  const location = { label: "Example place", coordinate: { latitude: 14.6, longitude: 121 } };
  return {
    origin: location,
    jobOffer: {
      id: input.id,
      title: "Engineer",
      company: "Example Co.",
      monthlySalary: input.salary,
      officeLocation: location,
      workArrangement: "hybrid",
      onsiteDaysPerWeek: 3,
      workingHoursPerDay: 8,
      estimatedTakeHomeRate: input.rate,
    },
    fareDiscountClass: "regular",
    commute: {
      route: null,
      segments: [],
      oneWayFare: input.monthlyFare / 24,
      dailyFare: input.monthlyFare / 12,
      monthlyFare: input.monthlyFare,
      annualFare: input.monthlyFare * 12,
      oneWayMinutes: 0,
      dailyMinutes: 0,
      monthlyMinutes: 0,
      annualMinutes: 0,
      officeDaysPerMonth: 12,
    },
    estimatedTakeHomePay: input.salary * input.rate,
    incomeAfterCommute: input.incomeAfterCommute,
    commuteBurdenPercentage: 0,
    monthlyCommuteHours: 0,
    monthlyWorkHours: 0,
    effectiveMonthlyHours: 0,
    effectiveHourlyValue: 0,
    sources: [],
  };
}

describe("break-even salary", () => {
  it("inverts cash after transport without including commute time", () => {
    expect(
      calculateRequiredGrossSalary({
        targetIncomeAfterCommute: 40_000,
        monthlyCommuteFare: 2_000,
        estimatedTakeHomeRate: 0.9,
      }),
    ).toBeCloseTo(46_666.6667);
    expect(
      minimumRequiredGrossSalary({
        targetIncomeAfterCommute: 40_000,
        monthlyCommuteFare: 2_000,
        estimatedTakeHomeRate: 0.9,
      }),
    ).toBe(46_667);
  });

  it("handles zero commute and negative cash targets safely", () => {
    expect(
      calculateRequiredGrossSalary({ monthlyCommuteFare: 0, estimatedTakeHomeRate: 0.9 }),
    ).toBe(0);
    expect(
      minimumRequiredGrossSalary({
        targetIncomeAfterCommute: -5_000,
        monthlyCommuteFare: 2_000,
        estimatedTakeHomeRate: 0.9,
      }),
    ).toBe(0);
  });

  it("rejects invalid financial inputs", () => {
    expect(() => calculateRequiredGrossSalary({ monthlyCommuteFare: -1 })).toThrow(RangeError);
    expect(() =>
      calculateRequiredGrossSalary({ monthlyCommuteFare: 1, estimatedTakeHomeRate: 0 }),
    ).toThrow(RangeError);
    expect(() =>
      calculateRequiredGrossSalary({ monthlyCommuteFare: 1, targetIncomeAfterCommute: Number.NaN }),
    ).toThrow(RangeError);
  });

  it("provides a salary threshold for one offer and Job B matching Job A", () => {
    const jobA = analysis({
      id: "a",
      salary: 45_000,
      rate: 0.9,
      monthlyFare: 1_000,
      incomeAfterCommute: 35_000,
    });
    const jobB = analysis({
      id: "b",
      salary: 40_000,
      rate: 0.8,
      monthlyFare: 3_000,
      incomeAfterCommute: 29_000,
    });

    const zeroCash = calculateJobBreakEvenSalary(jobB);
    expect(zeroCash.minimumGrossMonthlySalary).toBe(3_750);
    expect(zeroCash.grossSalaryDeltaFromCurrent).toBeCloseTo(-36_250);

    const matchA = calculateJobBMatchBreakEvenSalary(compareJobRealities(jobA, jobB));
    expect(matchA.targetIncomeAfterCommute).toBe(35_000);
    expect(matchA.requiredGrossMonthlySalary).toBe(47_500);
    expect(matchA.minimumGrossMonthlySalary).toBe(47_500);
    expect(matchA.grossSalaryDeltaFromCurrent).toBe(7_500);
  });
});
