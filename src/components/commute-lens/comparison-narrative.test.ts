import { describe, expect, it } from "vitest";
import type { ComparedMetric, JobRealityAnalysis, JobRealityComparison } from "@/domain/models";
import { buildComparisonVerdict, leaderLabel } from "./comparison-narrative";

/** `difference` is jobB − jobA, matching `compareJobRealities`. */
function metric(jobA: number, jobB: number): ComparedMetric {
  return { jobA, jobB, difference: jobB - jobA };
}

function comparison(
  overrides: Partial<JobRealityComparison["metrics"]> = {},
): JobRealityComparison {
  const empty = {} as JobRealityAnalysis;
  return {
    jobA: empty,
    jobB: empty,
    metrics: {
      monthlySalary: metric(70_000, 70_000),
      estimatedTakeHomePay: metric(63_000, 63_000),
      monthlyCommuteCost: metric(2_000, 2_000),
      monthlyCommuteHours: metric(30, 30),
      incomeAfterCommute: metric(61_000, 61_000),
      commuteBurdenPercentage: metric(3, 3),
      effectiveHourlyValue: metric(300, 300),
      ...overrides,
    },
  };
}

describe("buildComparisonVerdict", () => {
  it("names a single leader when both measures agree", () => {
    const verdict = buildComparisonVerdict(
      comparison({
        incomeAfterCommute: metric(61_000, 65_000),
        effectiveHourlyValue: metric(300, 330),
      }),
    );

    expect(verdict.cash).toBe("B");
    expect(verdict.hourly).toBe("B");
    expect(verdict.agreement).toBe("aligned");
    expect(verdict.headline).toContain("Job B leads on both");
  });

  it("refuses a universal winner when the measures disagree", () => {
    const verdict = buildComparisonVerdict(
      comparison({
        incomeAfterCommute: metric(61_000, 65_000),
        effectiveHourlyValue: metric(330, 300),
      }),
    );

    expect(verdict.agreement).toBe("split");
    expect(verdict.cash).toBe("B");
    expect(verdict.hourly).toBe("A");
    expect(verdict.headline).toContain("No single winner");
  });

  it("treats negligible gaps as level rather than as a win", () => {
    const verdict = buildComparisonVerdict(
      comparison({
        incomeAfterCommute: metric(61_000, 61_000.4),
        effectiveHourlyValue: metric(300, 300.001),
        monthlyCommuteHours: metric(30, 30.01),
      }),
    );

    expect(verdict.cash).toBe("tie");
    expect(verdict.hourly).toBe("tie");
    expect(verdict.commuteTime).toBe("tie");
    expect(verdict.agreement).toBe("tie");
  });

  it("awards the commute-time lead to the shorter commute", () => {
    const verdict = buildComparisonVerdict(comparison({ monthlyCommuteHours: metric(30, 12) }));
    expect(verdict.commuteTime).toBe("B");

    const reversed = buildComparisonVerdict(comparison({ monthlyCommuteHours: metric(12, 30) }));
    expect(reversed.commuteTime).toBe("A");
  });

  it("explains the cause: a bigger salary undone by a costlier commute", () => {
    const verdict = buildComparisonVerdict(
      comparison({
        monthlySalary: metric(70_000, 85_000),
        monthlyCommuteCost: metric(2_000, 9_000),
        monthlyCommuteHours: metric(30, 62),
        incomeAfterCommute: metric(61_000, 67_500),
      }),
    );

    expect(verdict.tradeOff[0]).toContain("Job B advertises");
    expect(verdict.tradeOff[1]).toContain("more");
    expect(verdict.tradeOff[1]).toContain("longer");
    expect(verdict.tradeOff[2]).toContain("Job B leaves");
  });

  it("says so plainly when nothing separates the two", () => {
    const verdict = buildComparisonVerdict(comparison());
    expect(verdict.tradeOff[0]).toContain("same monthly salary");
    expect(verdict.tradeOff[1]).toContain("about the same");
    expect(verdict.tradeOff).toHaveLength(2);
  });

  it("labels a tie without inventing a job letter", () => {
    expect(leaderLabel("tie")).toBe("Level");
    expect(leaderLabel("A")).toBe("Job A");
  });
});
