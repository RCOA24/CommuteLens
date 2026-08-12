import {
  calculateRequiredGrossSalary,
  minimumRequiredGrossSalary,
} from "@/domain/finance/calculations";
import type { JobRealityAnalysis, JobRealityComparison } from "@/domain/models";
import { TAKE_HOME_ASSUMPTIONS } from "@/shared/constants/assumptions";

/** Deterministic salary threshold for one already-calculated job reality. */
export interface JobBreakEvenSalary {
  targetIncomeAfterCommute: number;
  monthlyCommuteFare: number;
  estimatedTakeHomeRate: number;
  requiredGrossMonthlySalary: number;
  minimumGrossMonthlySalary: number;
  grossSalaryDeltaFromCurrent: number;
}

/**
 * Calculates the gross salary required to reach a monthly cash target after
 * transport. The calculation uses the analysis's disclosed take-home estimate;
 * it is not payroll, tax, or financial advice.
 */
export function calculateJobBreakEvenSalary(
  analysis: JobRealityAnalysis,
  targetIncomeAfterCommute = 0,
): JobBreakEvenSalary {
  const estimatedTakeHomeRate =
    analysis.jobOffer.estimatedTakeHomeRate ?? TAKE_HOME_ASSUMPTIONS.estimatedRate;
  const input = {
    targetIncomeAfterCommute,
    monthlyCommuteFare: analysis.commute.monthlyFare,
    estimatedTakeHomeRate,
  };
  const requiredGrossMonthlySalary = calculateRequiredGrossSalary(input);
  const minimumGrossMonthlySalary = minimumRequiredGrossSalary(input);

  return {
    targetIncomeAfterCommute,
    monthlyCommuteFare: analysis.commute.monthlyFare,
    estimatedTakeHomeRate,
    requiredGrossMonthlySalary,
    minimumGrossMonthlySalary,
    grossSalaryDeltaFromCurrent: requiredGrossMonthlySalary - analysis.jobOffer.monthlySalary,
  };
}

/**
 * The salary Job B needs for the same cash after transport as Job A now has.
 * Job B's own take-home assumption and fare are the only values inverted.
 */
export function calculateJobBMatchBreakEvenSalary(
  comparison: JobRealityComparison,
): JobBreakEvenSalary {
  return calculateJobBreakEvenSalary(comparison.jobB, comparison.jobA.incomeAfterCommute);
}
