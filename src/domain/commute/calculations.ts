import { COMMUTE_ASSUMPTIONS } from "@/shared/constants/assumptions";
import type { CommuteAnalysis, CommuteRoute } from "@/domain/models";

export function calculateCommute(
  route: CommuteRoute | null,
  officeDaysPerWeek: number,
): CommuteAnalysis {
  if (!Number.isInteger(officeDaysPerWeek) || officeDaysPerWeek < 0 || officeDaysPerWeek > 7) {
    throw new RangeError("Office days per week must be an integer from 0 to 7.");
  }

  const officeDaysPerMonth = officeDaysPerWeek * COMMUTE_ASSUMPTIONS.averageWeeksPerMonth;

  if (officeDaysPerWeek === 0 || route === null) {
    return {
      route,
      segments: route?.segments ?? [],
      oneWayFare: 0,
      dailyFare: 0,
      monthlyFare: 0,
      annualFare: 0,
      oneWayMinutes: 0,
      dailyMinutes: 0,
      monthlyMinutes: 0,
      annualMinutes: 0,
      officeDaysPerMonth,
    };
  }

  const dailyFare = route.oneWayFare * 2;
  const dailyMinutes = route.oneWayDurationMinutes * 2;
  const annualOfficeDays = officeDaysPerWeek * COMMUTE_ASSUMPTIONS.workingWeeksPerYear;

  return {
    route,
    segments: route.segments,
    oneWayFare: route.oneWayFare,
    dailyFare,
    monthlyFare: dailyFare * officeDaysPerMonth,
    annualFare: dailyFare * annualOfficeDays,
    oneWayMinutes: route.oneWayDurationMinutes,
    dailyMinutes,
    monthlyMinutes: dailyMinutes * officeDaysPerMonth,
    annualMinutes: dailyMinutes * annualOfficeDays,
    officeDaysPerMonth,
  };
}
