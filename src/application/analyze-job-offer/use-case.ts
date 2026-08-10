import { calculateCommute } from "@/domain/commute/calculations";
import {
  calculateCommuteBurden,
  calculateEffectiveHourlyValue,
  calculateMonthlyWorkHours,
  estimateTakeHomePay,
} from "@/domain/finance/calculations";
import type { JobRealityAnalysis } from "@/domain/models";
import type { TransitProvider } from "@/providers/transit/transit-provider";
import { commuteRouteSchema } from "@/shared/validation/domain-schemas";
import type { ApiResult } from "@/shared/types/api";
import { analyzeJobOfferSchema } from "./schema";

export type AnalyzeJobOfferResult = ApiResult<
  JobRealityAnalysis,
  "INVALID_INPUT" | "ROUTE_NOT_FOUND" | "TRANSIT_PROVIDER_UNAVAILABLE"
>;

export class AnalyzeJobOfferUseCase {
  constructor(private readonly transitProvider: TransitProvider) {}

  async execute(untrustedInput: unknown): Promise<AnalyzeJobOfferResult> {
    const parsed = analyzeJobOfferSchema.safeParse(untrustedInput);
    if (!parsed.success)
      return {
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: parsed.error.issues[0]?.message ?? "Invalid input.",
        },
      };

    const { origin, jobOffer } = parsed.data;
    let route = null;
    if (jobOffer.onsiteDaysPerWeek > 0) {
      let result;
      try {
        result = await this.transitProvider.findRoutes({
          origin,
          destination: jobOffer.officeLocation,
        });
      } catch {
        return {
          success: false,
          error: {
            code: "TRANSIT_PROVIDER_UNAVAILABLE",
            message: "The transit provider is temporarily unavailable.",
          },
        };
      }
      if (result.status !== "success") {
        return {
          success: false,
          error: {
            code:
              result.status === "unsupported" ? "ROUTE_NOT_FOUND" : "TRANSIT_PROVIDER_UNAVAILABLE",
            message: result.message,
          },
        };
      }
      const normalizedRoute = commuteRouteSchema.safeParse(result.routes[0]);
      if (!normalizedRoute.success) {
        return {
          success: false,
          error: {
            code: "TRANSIT_PROVIDER_UNAVAILABLE",
            message: "The transit provider returned an invalid route.",
          },
        };
      }
      route = normalizedRoute.data;
    }

    const commute = calculateCommute(route, jobOffer.onsiteDaysPerWeek);
    const estimatedTakeHomePay = estimateTakeHomePay(jobOffer.monthlySalary);
    const incomeAfterCommute = estimatedTakeHomePay - commute.monthlyFare;
    const monthlyCommuteHours = commute.monthlyMinutes / 60;
    const monthlyWorkHours = calculateMonthlyWorkHours(jobOffer.workingHoursPerDay);

    return {
      success: true,
      data: {
        jobOffer,
        commute,
        estimatedTakeHomePay,
        incomeAfterCommute,
        commuteBurdenPercentage: calculateCommuteBurden(commute.monthlyFare, estimatedTakeHomePay),
        monthlyCommuteHours,
        monthlyWorkHours,
        effectiveMonthlyHours: monthlyWorkHours + monthlyCommuteHours,
        effectiveHourlyValue: calculateEffectiveHourlyValue({
          incomeAfterCommute,
          workingHoursPerDay: jobOffer.workingHoursPerDay,
          monthlyCommuteHours,
        }),
        sources: route?.sources ?? [],
      },
    };
  }
}
