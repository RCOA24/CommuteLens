import { COMMUTE_ASSUMPTIONS, TAKE_HOME_ASSUMPTIONS } from "@/shared/constants/assumptions";

export function estimateTakeHomePay(monthlySalary: number): number {
  assertNonNegativeFinite(monthlySalary, "Monthly salary");
  return monthlySalary * TAKE_HOME_ASSUMPTIONS.estimatedRate;
}

export function calculateCommuteBurden(monthlyCommuteCost: number, takeHomePay: number): number {
  assertNonNegativeFinite(monthlyCommuteCost, "Monthly commute cost");
  assertNonNegativeFinite(takeHomePay, "Take-home pay");
  return takeHomePay === 0 ? 0 : (monthlyCommuteCost / takeHomePay) * 100;
}

export function calculateMonthlyWorkHours(workingHoursPerDay: number): number {
  if (!Number.isFinite(workingHoursPerDay) || workingHoursPerDay <= 0 || workingHoursPerDay > 24) {
    throw new RangeError("Working hours per day must be greater than 0 and no more than 24.");
  }

  return (
    workingHoursPerDay *
    COMMUTE_ASSUMPTIONS.workingDaysPerWeek *
    COMMUTE_ASSUMPTIONS.averageWeeksPerMonth
  );
}

export function calculateEffectiveHourlyValue(input: {
  incomeAfterCommute: number;
  workingHoursPerDay: number;
  monthlyCommuteHours: number;
}): number {
  assertFinite(input.incomeAfterCommute, "Income after commute");
  assertNonNegativeFinite(input.monthlyCommuteHours, "Monthly commute hours");
  const monthlyWorkHours = calculateMonthlyWorkHours(input.workingHoursPerDay);
  const effectiveHours = monthlyWorkHours + input.monthlyCommuteHours;
  return effectiveHours === 0 ? 0 : input.incomeAfterCommute / effectiveHours;
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative finite number.`);
  }
}

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${label} must be a finite number.`);
  }
}
