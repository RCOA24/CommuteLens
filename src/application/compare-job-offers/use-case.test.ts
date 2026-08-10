import { describe, expect, it } from "vitest";
import { DEMO_LOCATIONS } from "@/data/demo-routes";
import { MockTransitProvider } from "@/providers/transit/mock-transit.provider";
import { CompareJobOffersUseCase } from "./use-case";

const sharedJob = {
  title: "Developer",
  company: "Example",
  officeLocation: DEMO_LOCATIONS.bgc,
  workingHoursPerDay: 8,
};

describe("CompareJobOffersUseCase", () => {
  it("analyzes both jobs with the same engine and reports Job B minus Job A", async () => {
    const result = await new CompareJobOffersUseCase(new MockTransitProvider()).execute({
      jobA: {
        origin: DEMO_LOCATIONS.cubao,
        jobOffer: {
          ...sharedJob,
          id: "job-a",
          monthlySalary: 45_000,
          workArrangement: "hybrid",
          onsiteDaysPerWeek: 3,
        },
      },
      jobB: {
        origin: DEMO_LOCATIONS.cubao,
        jobOffer: {
          ...sharedJob,
          id: "job-b",
          monthlySalary: 42_000,
          workArrangement: "remote",
          onsiteDaysPerWeek: 0,
        },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metrics.monthlySalary.difference).toBe(-3_000);
      expect(result.data.metrics.monthlyCommuteCost.jobB).toBe(0);
      expect(result.data.jobA.sources[0]?.type).toBe("demo");
      expect(result.data.jobB.sources).toEqual([]);
    }
  });

  it("rejects the whole comparison when either job is invalid", async () => {
    const result = await new CompareJobOffersUseCase(new MockTransitProvider()).execute({
      jobA: {},
      jobB: {},
    });
    expect(result.success).toBe(false);
  });
});
