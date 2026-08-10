import { COMMUTE_ASSUMPTIONS } from "@/shared/constants/assumptions";
import type { CommuteAnalysis, CommuteRoute } from "@/domain/models";

export function calculateCommute(
  route: CommuteRoute | null,
  officeDaysPerWeek: number,
): CommuteAnalysis {
  if (officeDaysPerWeek === 0 || route === null) {
    return { route, dailyFare: 0, monthlyFare: 0, annualFare: 0, dailyMinutes: 0, monthlyMinutes: 0, annualMinutes: 0 };
  }

  const dailyFare = route.oneWayFare * 2;
  const dailyMinutes = route.oneWayDurationMinutes * 2;
  const monthlyOfficeDays = officeDaysPerWeek * COMMUTE_ASSUMPTIONS.averageWeeksPerMonth;
  const annualOfficeDays = officeDaysPerWeek * COMMUTE_ASSUMPTIONS.workingWeeksPerYear;

  return {
    route,
    dailyFare,
    monthlyFare: dailyFare * monthlyOfficeDays,
    annualFare: dailyFare * annualOfficeDays,
    dailyMinutes,
    monthlyMinutes: dailyMinutes * monthlyOfficeDays,
    annualMinutes: dailyMinutes * annualOfficeDays,
  };
}
