import { calculateCommute } from "@/domain/commute/calculations";
import { appliedFareDiscountClass, applyFareDiscount } from "@/domain/fare";
import {
  calculateCommuteBurden,
  calculateEffectiveHourlyValue,
  calculateMonthlyWorkHours,
  calculateTakeHomePay,
} from "@/domain/finance/calculations";
import { estimatePhilippinePayroll } from "@/domain/finance/philippine-payroll";
import type { JobRealityAnalysis } from "@/domain/models";
import type { TransitProvider } from "@/providers/transit/transit-provider";
import { commuteRouteSchema } from "@/shared/validation/domain-schemas";
import type { ApiResult } from "@/shared/types/api";
import { distanceKm } from "@/shared/geo/distance";
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

    const { origin, jobOffer, discountClass } = parsed.data;
    let route = parsed.data.route ?? null;
    if (route) {
      const routeOrigin = route.segments[0]?.origin.coordinate;
      const routeDestination = route.segments.at(-1)?.destination.coordinate;
      if (
        !routeOrigin ||
        !routeDestination ||
        distanceKm(routeOrigin, origin.coordinate) > 0.25 ||
        distanceKm(routeDestination, jobOffer.officeLocation.coordinate) > 0.25
      ) {
        return {
          success: false,
          error: {
            code: "INVALID_INPUT",
            message: "The preview route does not match the selected locations.",
          },
        };
      }

      /*
       * A preview route arrives already priced for a fare class. If it disagrees
       * with the class being claimed now, the discount cannot be recovered from
       * the discounted fares, so the caller must re-discover rather than have us
       * report a figure that matches neither class.
       */
      const routeEntitlement = appliedFareDiscountClass(route);
      if (routeEntitlement !== null && routeEntitlement !== discountClass) {
        return {
          success: false,
          error: {
            code: "INVALID_INPUT",
            message: "Your fare class changed. Search the route again to reprice it.",
          },
        };
      }
      // No-op when the preview already carried this entitlement.
      route = applyFareDiscount(route, discountClass);
    }
    if (jobOffer.onsiteDaysPerWeek > 0) {
      if (!route) {
        let result;
        try {
          result = await this.transitProvider.findRoutes({
            origin,
            destination: jobOffer.officeLocation,
            discountClass,
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
                result.status === "unsupported"
                  ? "ROUTE_NOT_FOUND"
                  : "TRANSIT_PROVIDER_UNAVAILABLE",
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
    }

    const commute = calculateCommute(route, jobOffer.onsiteDaysPerWeek);
    const payrollEstimate = jobOffer.payrollDeductions
      ? estimatePhilippinePayroll(jobOffer.monthlySalary, jobOffer.payrollDeductions)
      : undefined;
    const estimatedTakeHomePay = calculateTakeHomePay({
      monthlySalary: jobOffer.monthlySalary,
      payrollDeductions: jobOffer.payrollDeductions,
      estimatedTakeHomeRate: jobOffer.estimatedTakeHomeRate,
    });
    const incomeAfterCommute = estimatedTakeHomePay - commute.monthlyFare;
    const monthlyCommuteHours = commute.monthlyMinutes / 60;
    const workingDaysPerWeek = jobOffer.workingDaysPerWeek ?? 5;
    const monthlyWorkHours = calculateMonthlyWorkHours(
      jobOffer.workingHoursPerDay,
      workingDaysPerWeek,
    );

    return {
      success: true,
      data: {
        origin,
        jobOffer,
        fareDiscountClass: discountClass,
        commute,
        payrollEstimate,
        estimatedTakeHomePay,
        incomeAfterCommute,
        commuteBurdenPercentage: calculateCommuteBurden(commute.monthlyFare, estimatedTakeHomePay),
        monthlyCommuteHours,
        monthlyWorkHours,
        effectiveMonthlyHours: monthlyWorkHours + monthlyCommuteHours,
        effectiveHourlyValue: calculateEffectiveHourlyValue({
          incomeAfterCommute,
          workingHoursPerDay: jobOffer.workingHoursPerDay,
          workingDaysPerWeek,
          monthlyCommuteHours,
        }),
        sources: route?.sources ?? [],
      },
    };
  }
}
