import { describe, expect, it } from "vitest";
import { DEMO_LOCATIONS, DEMO_ROUTES } from "@/data/demo-routes";
import { MockTransitProvider } from "@/providers/transit/mock-transit.provider";
import type { TransitProvider, TransitRouteResult } from "@/providers/transit/transit-provider";
import { AnalyzeJobOfferUseCase } from "./use-case";

const baseJob = {
  id: "job-a",
  title: "Developer",
  company: "Example",
  monthlySalary: 45_000,
  officeLocation: DEMO_LOCATIONS.bgc,
  workArrangement: "hybrid" as const,
  onsiteDaysPerWeek: 3,
  workingHoursPerDay: 8,
};

describe("AnalyzeJobOfferUseCase", () => {
  it("runs the deterministic demo hero path and preserves provenance", async () => {
    const result = await new AnalyzeJobOfferUseCase(new MockTransitProvider()).execute({
      origin: DEMO_LOCATIONS.cubao,
      jobOffer: baseJob,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sources[0]?.type).toBe("demo");
      expect(result.data.incomeAfterCommute).toBeCloseTo(39_382);
    }
  });

  it("does not call transit for a valid remote job", async () => {
    const result = await new AnalyzeJobOfferUseCase(new MockTransitProvider()).execute({
      origin: DEMO_LOCATIONS.cubao,
      jobOffer: { ...baseJob, workArrangement: "remote", onsiteDaysPerWeek: 0 },
    });
    expect(result.success && result.data.commute.monthlyFare).toBe(0);
  });

  it("rejects inconsistent remote attendance", async () => {
    const result = await new AnalyzeJobOfferUseCase(new MockTransitProvider()).execute({
      origin: DEMO_LOCATIONS.cubao,
      jobOffer: { ...baseJob, workArrangement: "remote" },
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("INVALID_INPUT");
  });

  it("maps provider exceptions to an explicit availability error", async () => {
    const provider: TransitProvider = {
      findRoutes: async (): Promise<TransitRouteResult> => {
        throw new Error("Provider secret must not escape");
      },
    };
    const result = await new AnalyzeJobOfferUseCase(provider).execute({
      origin: DEMO_LOCATIONS.cubao,
      jobOffer: baseJob,
    });
    expect(result).toEqual({
      success: false,
      error: {
        code: "TRANSIT_PROVIDER_UNAVAILABLE",
        message: "The transit provider is temporarily unavailable.",
      },
    });
  });

  it("rejects inconsistent normalized provider totals", async () => {
    const invalidRoute = { ...DEMO_ROUTES[0], oneWayFare: 999 };
    const provider: TransitProvider = {
      findRoutes: async () => ({ status: "success", routes: [invalidRoute] }),
    };
    const result = await new AnalyzeJobOfferUseCase(provider).execute({
      origin: DEMO_LOCATIONS.cubao,
      jobOffer: baseJob,
    });
    expect(!result.success && result.error.code).toBe("TRANSIT_PROVIDER_UNAVAILABLE");
  });
});
