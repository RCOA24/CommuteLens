import { describe, expect, it } from "vitest";
import { DEMO_LOCATIONS } from "@/data/demo-routes";
import { MockTransitProvider } from "@/providers/transit/mock-transit.provider";
import { AnalyzeJobOfferUseCase } from "./use-case";

const baseJob = { id: "job-a", title: "Developer", company: "Example", monthlySalary: 45_000, officeLocation: DEMO_LOCATIONS.bgc, workArrangement: "hybrid" as const, onsiteDaysPerWeek: 3, workingHoursPerDay: 8 };

describe("AnalyzeJobOfferUseCase", () => {
  it("runs the deterministic demo hero path and preserves provenance", async () => {
    const result = await new AnalyzeJobOfferUseCase(new MockTransitProvider()).execute({ origin: DEMO_LOCATIONS.cubao, jobOffer: baseJob });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sources[0]?.type).toBe("demo");
      expect(result.data.incomeAfterCommute).toBeCloseTo(39_382);
    }
  });

  it("does not call transit for a valid remote job", async () => {
    const result = await new AnalyzeJobOfferUseCase(new MockTransitProvider()).execute({ origin: DEMO_LOCATIONS.cubao, jobOffer: { ...baseJob, workArrangement: "remote", onsiteDaysPerWeek: 0 } });
    expect(result.success && result.data.commute.monthlyFare).toBe(0);
  });

  it("rejects inconsistent remote attendance", async () => {
    const result = await new AnalyzeJobOfferUseCase(new MockTransitProvider()).execute({ origin: DEMO_LOCATIONS.cubao, jobOffer: { ...baseJob, workArrangement: "remote" } });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("INVALID_INPUT");
  });
});
