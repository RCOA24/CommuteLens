import { COMMUTE_ASSUMPTIONS, TAKE_HOME_ASSUMPTIONS } from "@/shared/constants/assumptions";

export function estimateTakeHomePay(monthlySalary: number): number {
  return monthlySalary * TAKE_HOME_ASSUMPTIONS.estimatedRate;
}

export function calculateCommuteBurden(monthlyCommuteCost: number, takeHomePay: number): number {
  return takeHomePay === 0 ? 0 : (monthlyCommuteCost / takeHomePay) * 100;
}

export function calculateEffectiveHourlyValue(input: {
  incomeAfterCommute: number;
  workingHoursPerDay: number;
  officeDaysPerWeek: number;
  monthlyCommuteHours: number;
}): number {
  const monthlyWorkHours =
    input.workingHoursPerDay * 5 * COMMUTE_ASSUMPTIONS.averageWeeksPerMonth;
  const effectiveHours = monthlyWorkHours + (input.officeDaysPerWeek > 0 ? input.monthlyCommuteHours : 0);
  return effectiveHours === 0 ? 0 : input.incomeAfterCommute / effectiveHours;
}
