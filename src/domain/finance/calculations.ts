import { COMMUTE_ASSUMPTIONS, TAKE_HOME_ASSUMPTIONS } from "@/shared/constants/assumptions";

export function estimateTakeHomePay(
  monthlySalary: number,
  estimatedRate: number = TAKE_HOME_ASSUMPTIONS.estimatedRate,
): number {
  assertNonNegativeFinite(monthlySalary, "Monthly salary");
  assertTakeHomeRate(estimatedRate);
  return monthlySalary * estimatedRate;
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

/**
 * Inverts the cash-after-transport equation:
 * gross salary × take-home rate − monthly commute fare = target cash.
 *
 * Time deliberately does not appear here. It is a quality-of-life and
 * effective-hourly-value factor, not money that should be added to a salary.
 */
export function calculateRequiredGrossSalary(input: {
  targetIncomeAfterCommute?: number;
  monthlyCommuteFare: number;
  estimatedTakeHomeRate?: number;
}): number {
  const targetIncomeAfterCommute = input.targetIncomeAfterCommute ?? 0;
  const estimatedTakeHomeRate = input.estimatedTakeHomeRate ?? TAKE_HOME_ASSUMPTIONS.estimatedRate;
  assertFinite(targetIncomeAfterCommute, "Target income after commute");
  assertNonNegativeFinite(input.monthlyCommuteFare, "Monthly commute fare");
  assertTakeHomeRate(estimatedTakeHomeRate);
  return Math.max(0, (targetIncomeAfterCommute + input.monthlyCommuteFare) / estimatedTakeHomeRate);
}

/** Minimum whole-peso gross salary that will not undershoot the cash target. */
export function minimumRequiredGrossSalary(input: {
  targetIncomeAfterCommute?: number;
  monthlyCommuteFare: number;
  estimatedTakeHomeRate?: number;
}): number {
  return Math.ceil(calculateRequiredGrossSalary(input));
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

function assertTakeHomeRate(value: number): void {
  if (!Number.isFinite(value) || value < 0.5 || value > 1) {
    throw new RangeError("Estimated take-home rate must be between 0.5 and 1.");
  }
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
