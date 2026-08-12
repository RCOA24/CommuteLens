import { describe, expect, it, vi } from "vitest";
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

  it("defaults to full fare when no entitlement is supplied", async () => {
    const result = await new AnalyzeJobOfferUseCase(new MockTransitProvider()).execute({
      origin: DEMO_LOCATIONS.cubao,
      jobOffer: baseJob,
    });
    expect(result.success && result.data.fareDiscountClass).toBe("regular");
  });

  /**
   * The statutory discount has to survive the whole round trip: request schema,
   * provider request, route pricing, and the analysis the receipt renders.
   */
  it("prices an entitled commuter's commute below a regular one", async () => {
    const forClass = async (discountClass: "regular" | "student") => {
      const result = await new AnalyzeJobOfferUseCase(new MockTransitProvider()).execute({
        origin: DEMO_LOCATIONS.cubao,
        discountClass,
        jobOffer: baseJob,
      });
      if (!result.success) throw new Error("hero path should analyze");
      return result.data;
    };

    const regular = await forClass("regular");
    const student = await forClass("student");

    expect(student.fareDiscountClass).toBe("student");
    expect(student.commute.monthlyFare).toBeLessThan(regular.commute.monthlyFare);
    expect(student.commute.monthlyFare).toBeGreaterThan(0);
    // Less spent getting there means more cash left and a lighter burden.
    expect(student.incomeAfterCommute).toBeGreaterThan(regular.incomeAfterCommute);
    expect(student.commuteBurdenPercentage).toBeLessThan(regular.commuteBurdenPercentage);
    // Time is unchanged: a discount buys back pesos, never hours.
    expect(student.monthlyCommuteHours).toBeCloseTo(regular.monthlyCommuteHours, 6);
  });

  it("does not call transit for a valid remote job", async () => {
    const result = await new AnalyzeJobOfferUseCase(new MockTransitProvider()).execute({
      origin: DEMO_LOCATIONS.cubao,
      jobOffer: { ...baseJob, workArrangement: "remote", onsiteDaysPerWeek: 0 },
    });
    expect(result.success && result.data.commute.monthlyFare).toBe(0);
  });

  it("reuses a validated preview route instead of consuming transit quota twice", async () => {
    const findRoutes = vi.fn();
    const result = await new AnalyzeJobOfferUseCase({ findRoutes }).execute({
      origin: DEMO_LOCATIONS.cubao,
      route: DEMO_ROUTES[0],
      jobOffer: baseJob,
    });
    expect(result.success).toBe(true);
    expect(findRoutes).not.toHaveBeenCalled();
  });

  it("rejects a preview route that belongs to different locations", async () => {
    const result = await new AnalyzeJobOfferUseCase(new MockTransitProvider()).execute({
      origin: DEMO_LOCATIONS.antipolo,
      route: DEMO_ROUTES[0],
      jobOffer: baseJob,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe("INVALID_INPUT");
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
