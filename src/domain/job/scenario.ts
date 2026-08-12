import { calculateCommute } from "@/domain/commute/calculations";
import {
  calculateCommuteBurden,
  calculateEffectiveHourlyValue,
  calculateMonthlyWorkHours,
  estimateTakeHomePay,
} from "@/domain/finance/calculations";
import type { CommuteRoute, JobRealityAnalysis } from "@/domain/models";

/** Recalculates a scenario from per-trip route facts, including remote baselines. */
export function calculateJobScenario(
  analysis: JobRealityAnalysis,
  onsiteDaysPerWeek: number,
  route: CommuteRoute | null = analysis.commute.route,
) {
  const commute = calculateCommute(route, onsiteDaysPerWeek);
  const estimatedTakeHomePay = estimateTakeHomePay(
    analysis.jobOffer.monthlySalary,
    analysis.jobOffer.estimatedTakeHomeRate,
  );
  const incomeAfterCommute = estimatedTakeHomePay - commute.monthlyFare;
  const monthlyCommuteHours = commute.monthlyMinutes / 60;
  const monthlyWorkHours = calculateMonthlyWorkHours(analysis.jobOffer.workingHoursPerDay);

  return {
    days: onsiteDaysPerWeek,
    onsiteDaysPerWeek,
    monthlyFare: commute.monthlyFare,
    monthlyMinutes: commute.monthlyMinutes,
    monthlyCommuteHours,
    monthlyHours: monthlyCommuteHours,
    estimatedTakeHomePay,
    incomeAfterCommute,
    commuteBurdenPercentage: calculateCommuteBurden(commute.monthlyFare, estimatedTakeHomePay),
    burden: calculateCommuteBurden(commute.monthlyFare, estimatedTakeHomePay),
    effectiveHourlyValue: calculateEffectiveHourlyValue({
      incomeAfterCommute,
      workingHoursPerDay: analysis.jobOffer.workingHoursPerDay,
      monthlyCommuteHours,
    }),
    monthlyWorkHours,
    effectiveMonthlyHours: monthlyWorkHours + monthlyCommuteHours,
  };
}

export type JobScenario = ReturnType<typeof calculateJobScenario>;

/** Candidate minus baseline. Positive means the candidate scenario has more of it. */
export interface JobScenarioDelta {
  onsiteDaysPerWeek: number;
  monthlyFare: number;
  monthlyCommuteHours: number;
  incomeAfterCommute: number;
  effectiveHourlyValue: number;
  commuteBurdenPercentage: number;
}

/**
 * The difference between two already-calculated scenarios.
 *
 * The scenario explorer needs to say "one fewer office day gives back ₱X and Y
 * hours". That is a comparison of two deterministic engine outputs, so it
 * belongs here next to the engine rather than in a component.
 */
export function diffJobScenarios(baseline: JobScenario, candidate: JobScenario): JobScenarioDelta {
  return {
    onsiteDaysPerWeek: candidate.onsiteDaysPerWeek - baseline.onsiteDaysPerWeek,
    monthlyFare: candidate.monthlyFare - baseline.monthlyFare,
    monthlyCommuteHours: candidate.monthlyCommuteHours - baseline.monthlyCommuteHours,
    incomeAfterCommute: candidate.incomeAfterCommute - baseline.incomeAfterCommute,
    effectiveHourlyValue: candidate.effectiveHourlyValue - baseline.effectiveHourlyValue,
    commuteBurdenPercentage: candidate.commuteBurdenPercentage - baseline.commuteBurdenPercentage,
  };
}
