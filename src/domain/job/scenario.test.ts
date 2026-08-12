import { describe, expect, it } from "vitest";
import { AnalyzeJobOfferUseCase } from "@/application/analyze-job-offer/use-case";
import { DEMO_OFFICES, DEMO_ORIGINS, DEMO_ROUTES } from "@/data/demo";
import { MockTransitProvider } from "@/providers/transit/mock-transit.provider";
import { calculateJobScenario, diffJobScenarios } from "./scenario";

describe("diffJobScenarios", () => {
  async function heroAnalysis() {
    const result = await new AnalyzeJobOfferUseCase(new MockTransitProvider()).execute({
      origin: DEMO_ORIGINS.cubao,
      route: DEMO_ROUTES[0],
      jobOffer: {
        id: "hero",
        title: "Developer",
        company: "Example",
        monthlySalary: 70_000,
        officeLocation: DEMO_OFFICES.bgc,
        workArrangement: "hybrid",
        onsiteDaysPerWeek: 3,
        workingHoursPerDay: 8,
        estimatedTakeHomeRate: 0.9,
      },
    });
    if (!result.success) throw new Error("fixture failed to analyze");
    return result.data;
  }

  it("reports what dropping one office day gives back", async () => {
    const analysis = await heroAnalysis();
    const baseline = calculateJobScenario(analysis, 3);
    const candidate = calculateJobScenario(analysis, 2);
    const delta = diffJobScenarios(baseline, candidate);

    expect(delta.onsiteDaysPerWeek).toBe(-1);
    expect(delta.monthlyFare).toBeLessThan(0);
    expect(delta.monthlyCommuteHours).toBeLessThan(0);
    expect(delta.incomeAfterCommute).toBeGreaterThan(0);
    expect(delta.commuteBurdenPercentage).toBeLessThan(0);
  });

  it("is zero in every dimension when both scenarios match", async () => {
    const analysis = await heroAnalysis();
    const scenario = calculateJobScenario(analysis, 3);
    const delta = diffJobScenarios(scenario, scenario);

    expect(delta).toEqual({
      onsiteDaysPerWeek: 0,
      monthlyFare: 0,
      monthlyCommuteHours: 0,
      incomeAfterCommute: 0,
      effectiveHourlyValue: 0,
      commuteBurdenPercentage: 0,
    });
  });

  it("prices a remote baseline moving onsite", async () => {
    const analysis = await heroAnalysis();
    const delta = diffJobScenarios(
      calculateJobScenario(analysis, 0),
      calculateJobScenario(analysis, 5),
    );

    expect(delta.onsiteDaysPerWeek).toBe(5);
    expect(delta.monthlyFare).toBeGreaterThan(0);
    expect(delta.incomeAfterCommute).toBeLessThan(0);
  });
});

describe("calculateJobScenario", () => {
  it("can move a remote baseline onsite using its retained route facts", async () => {
    const result = await new AnalyzeJobOfferUseCase(new MockTransitProvider()).execute({
      origin: DEMO_ORIGINS.cubao,
      route: DEMO_ROUTES[0],
      jobOffer: {
        id: "remote",
        title: "Developer",
        company: "Example",
        monthlySalary: 70_000,
        officeLocation: DEMO_OFFICES.bgc,
        workArrangement: "remote",
        onsiteDaysPerWeek: 0,
        workingHoursPerDay: 8,
        estimatedTakeHomeRate: 0.9,
      },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.commute.monthlyFare).toBe(0);
    const scenario = calculateJobScenario(result.data, 3);
    expect(scenario.monthlyFare).toBeGreaterThan(0);
    expect(scenario.monthlyHours).toBeGreaterThan(0);
  });
});
