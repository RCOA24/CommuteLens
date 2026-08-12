import {
  calculateRequiredGrossSalary,
  minimumRequiredGrossSalary,
} from "@/domain/finance/calculations";
import type { CommuteRoute, JobRealityAnalysis } from "@/domain/models";
import { TAKE_HOME_ASSUMPTIONS } from "@/shared/constants/assumptions";
import { calculateJobScenario, type JobScenario } from "./scenario";

const ONSITE_DAYS = [0, 1, 2, 3, 4, 5] as const;

export type OnsiteDaysPerWeek = (typeof ONSITE_DAYS)[number];

/**
 * One viable working-arrangement option. Allowance is modeled as a net monthly
 * reimbursement, so it is added after the existing take-home estimate and
 * does not make a payroll or tax claim.
 */
export interface CommuteViabilityRow {
  onsiteDaysPerWeek: OnsiteDaysPerWeek;
  scenario: JobScenario;
  targetIncomeAfterCommute: number;
  isFeasibleAtCurrentSalary: boolean;
  requiredMonthlyCommuteAllowance: number;
  minimumMonthlyCommuteAllowance: number;
  estimatedTakeHomeRate: number;
  requiredGrossMonthlySalary: number;
  minimumGrossMonthlySalary: number;
  grossSalaryDeltaFromCurrent: number;
}

/** A deterministic set of all permitted 0–5 office-day arrangements. */
export interface CommuteViabilityPlan {
  targetIncomeAfterCommute: number;
  maximumSustainableOnsiteDays: OnsiteDaysPerWeek | null;
  rows: readonly CommuteViabilityRow[];
}

/**
 * Calculates the cash required to preserve a chosen monthly amount after
 * transport for every permitted onsite schedule. Commute time remains visible
 * on each scenario, but is intentionally not converted into money here.
 */
export function calculateCommuteViabilityPlan(input: {
  analysis: JobRealityAnalysis;
  route: CommuteRoute;
  targetIncomeAfterCommute: number;
}): CommuteViabilityPlan {
  assertNonNegativeFinite(input.targetIncomeAfterCommute, "Target income after commute");

  const estimatedTakeHomeRate =
    input.analysis.jobOffer.estimatedTakeHomeRate ?? TAKE_HOME_ASSUMPTIONS.estimatedRate;
  const rows = ONSITE_DAYS.map((onsiteDaysPerWeek) => {
    const scenario = calculateJobScenario(input.analysis, onsiteDaysPerWeek, input.route);
    const requiredMonthlyCommuteAllowance = Math.max(
      0,
      input.targetIncomeAfterCommute - scenario.incomeAfterCommute,
    );
    const salaryInput = {
      targetIncomeAfterCommute: input.targetIncomeAfterCommute,
      monthlyCommuteFare: scenario.monthlyFare,
      estimatedTakeHomeRate,
    };
    const requiredGrossMonthlySalary = calculateRequiredGrossSalary(salaryInput);

    return {
      onsiteDaysPerWeek,
      scenario,
      targetIncomeAfterCommute: input.targetIncomeAfterCommute,
      isFeasibleAtCurrentSalary: scenario.incomeAfterCommute >= input.targetIncomeAfterCommute,
      requiredMonthlyCommuteAllowance,
      minimumMonthlyCommuteAllowance: Math.ceil(requiredMonthlyCommuteAllowance),
      estimatedTakeHomeRate,
      requiredGrossMonthlySalary,
      minimumGrossMonthlySalary: minimumRequiredGrossSalary(salaryInput),
      grossSalaryDeltaFromCurrent:
        requiredGrossMonthlySalary - input.analysis.jobOffer.monthlySalary,
    } satisfies CommuteViabilityRow;
  });
  const feasibleRows = rows.filter((row) => row.isFeasibleAtCurrentSalary);

  return {
    targetIncomeAfterCommute: input.targetIncomeAfterCommute,
    maximumSustainableOnsiteDays: feasibleRows.at(-1)?.onsiteDaysPerWeek ?? null,
    rows,
  };
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative finite number.`);
  }
}
