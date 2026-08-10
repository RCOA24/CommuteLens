import { calculateCommute } from "@/domain/commute/calculations";
import { calculateCommuteBurden, calculateEffectiveHourlyValue, estimateTakeHomePay } from "@/domain/finance/calculations";
import type { JobRealityAnalysis } from "@/domain/models";
import type { TransitProvider } from "@/providers/transit/transit-provider";
import { analyzeJobOfferSchema, type AnalyzeJobOfferInput } from "./schema";

export type AnalyzeJobOfferResult =
  | { success: true; data: JobRealityAnalysis }
  | { success: false; error: { code: "INVALID_INPUT" | "ROUTE_NOT_FOUND" | "TRANSIT_PROVIDER_UNAVAILABLE"; message: string } };

export class AnalyzeJobOfferUseCase {
  constructor(private readonly transitProvider: TransitProvider) {}

  async execute(untrustedInput: AnalyzeJobOfferInput): Promise<AnalyzeJobOfferResult> {
    const parsed = analyzeJobOfferSchema.safeParse(untrustedInput);
    if (!parsed.success) return { success: false, error: { code: "INVALID_INPUT", message: parsed.error.issues[0]?.message ?? "Invalid input." } };

    const { origin, jobOffer } = parsed.data;
    let route = null;
    if (jobOffer.onsiteDaysPerWeek > 0) {
      const result = await this.transitProvider.findRoutes({ origin, destination: jobOffer.officeLocation });
      if (result.status !== "success") {
        return { success: false, error: { code: result.status === "unsupported" ? "ROUTE_NOT_FOUND" : "TRANSIT_PROVIDER_UNAVAILABLE", message: result.message } };
      }
      route = result.routes[0] ?? null;
    }

    const commute = calculateCommute(route, jobOffer.onsiteDaysPerWeek);
    const estimatedTakeHomePay = estimateTakeHomePay(jobOffer.monthlySalary);
    const incomeAfterCommute = estimatedTakeHomePay - commute.monthlyFare;
    const monthlyCommuteHours = commute.monthlyMinutes / 60;

    return {
      success: true,
      data: {
        jobOffer,
        commute,
        estimatedTakeHomePay,
        incomeAfterCommute,
        commuteBurdenPercentage: calculateCommuteBurden(commute.monthlyFare, estimatedTakeHomePay),
        monthlyCommuteHours,
        effectiveHourlyValue: calculateEffectiveHourlyValue({ incomeAfterCommute, workingHoursPerDay: jobOffer.workingHoursPerDay, officeDaysPerWeek: jobOffer.onsiteDaysPerWeek, monthlyCommuteHours }),
        sources: route?.sources ?? [],
      },
    };
  }
}
