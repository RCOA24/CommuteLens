import type { JobRealityAnalysis, JobRealityComparison } from "@/domain/models";
import { describeFareDiscount } from "@/domain/fare";
import { summarizeProvenance } from "@/data/demo";

/**
 * CL-010 — the only shape the AI layer is ever allowed to see.
 *
 * Everything here is already calculated by the Member 1 engines. The AI never
 * receives the raw request, the transit routes, or anything it could use to
 * recompute a metric. Free text supplied by the user is sanitised because it
 * would otherwise sit inside a prompt.
 */

const MAX_FREE_TEXT_LENGTH = 80;

/** Strips control characters and newlines so user text cannot restructure a prompt. */
export function sanitizeFreeText(value: string): string {
  return value
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_FREE_TEXT_LENGTH);
}

function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export interface AnalysisFacts {
  kind: "analysis";
  jobTitle: string;
  company: string;
  currency: "PHP";
  monthlySalary: number;
  estimatedTakeHomePay: number;
  monthlyCommuteCost: number;
  monthlyCommuteHours: number;
  incomeAfterCommute: number;
  commuteBurdenPercentage: number;
  effectiveHourlyValue: number;
  onsiteDaysPerWeek: number;
  oneWayMinutes: number;
  transfers: number;
  modes: string[];
  provenanceLabels: string[];
  /** Does not reveal a specific entitlement category to the AI provider. */
  fareDiscountApplied: boolean;
  /** Zero or the statutory discount percentage, safe for numeric guardrails. */
  fareDiscountPercentage: number;
  takeHomeIsEstimated: true;
}

export interface ComparisonFacts {
  kind: "comparison";
  jobA: AnalysisFacts;
  jobB: AnalysisFacts;
  deltas: {
    monthlySalary: number;
    incomeAfterCommute: number;
    monthlyCommuteCost: number;
    monthlyCommuteHours: number;
    commuteBurdenPercentage: number;
    effectiveHourlyValue: number;
  };
}

export type ExplanationFacts = AnalysisFacts | ComparisonFacts;

export function buildAnalysisFacts(analysis: JobRealityAnalysis): AnalysisFacts {
  const provenance = summarizeProvenance(analysis.sources);
  const fareDiscount = describeFareDiscount(analysis.fareDiscountClass);

  return {
    kind: "analysis",
    jobTitle: sanitizeFreeText(analysis.jobOffer.title),
    company: sanitizeFreeText(analysis.jobOffer.company),
    currency: "PHP",
    monthlySalary: round(analysis.jobOffer.monthlySalary),
    estimatedTakeHomePay: round(analysis.estimatedTakeHomePay),
    monthlyCommuteCost: round(analysis.commute.monthlyFare),
    monthlyCommuteHours: round(analysis.monthlyCommuteHours, 1),
    incomeAfterCommute: round(analysis.incomeAfterCommute),
    commuteBurdenPercentage: round(analysis.commuteBurdenPercentage, 1),
    effectiveHourlyValue: round(analysis.effectiveHourlyValue, 2),
    onsiteDaysPerWeek: analysis.jobOffer.onsiteDaysPerWeek,
    oneWayMinutes: round(analysis.commute.oneWayMinutes),
    transfers: analysis.commute.route?.transfers ?? 0,
    modes: [...new Set(analysis.commute.segments.map((segment) => segment.mode))],
    provenanceLabels: provenance?.descriptors.map((descriptor) => descriptor.label) ?? [],
    fareDiscountApplied: fareDiscount.rate > 0,
    fareDiscountPercentage: round(fareDiscount.rate * 100),
    takeHomeIsEstimated: true,
  };
}

export function buildComparisonFacts(comparison: JobRealityComparison): ComparisonFacts {
  const { metrics } = comparison;

  return {
    kind: "comparison",
    jobA: buildAnalysisFacts(comparison.jobA),
    jobB: buildAnalysisFacts(comparison.jobB),
    deltas: {
      monthlySalary: round(metrics.monthlySalary.difference),
      incomeAfterCommute: round(metrics.incomeAfterCommute.difference),
      monthlyCommuteCost: round(metrics.monthlyCommuteCost.difference),
      monthlyCommuteHours: round(metrics.monthlyCommuteHours.difference, 1),
      commuteBurdenPercentage: round(metrics.commuteBurdenPercentage.difference, 1),
      effectiveHourlyValue: round(metrics.effectiveHourlyValue.difference, 2),
    },
  };
}

/**
 * Every number the AI is permitted to state. Used by the output guard: a figure
 * that is not in this set means the model invented or recomputed something.
 */
export function permittedNumbers(facts: ExplanationFacts): number[] {
  if (facts.kind === "comparison") {
    return [
      ...permittedNumbers(facts.jobA),
      ...permittedNumbers(facts.jobB),
      ...Object.values(facts.deltas).flatMap((value) => [value, Math.abs(value)]),
    ];
  }

  return [
    facts.monthlySalary,
    facts.estimatedTakeHomePay,
    facts.monthlyCommuteCost,
    facts.monthlyCommuteHours,
    facts.incomeAfterCommute,
    facts.commuteBurdenPercentage,
    facts.effectiveHourlyValue,
    facts.onsiteDaysPerWeek,
    facts.oneWayMinutes,
    facts.transfers,
    facts.fareDiscountPercentage,
    // Rounded restatements a writer would naturally reach for.
    Math.round(facts.monthlyCommuteHours),
    Math.round(facts.commuteBurdenPercentage),
    Math.round(facts.effectiveHourlyValue),
  ];
}
