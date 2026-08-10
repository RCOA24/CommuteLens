import type { AnalysisFacts, ComparisonFacts, ExplanationFacts } from "./facts";

/**
 * CL-010 — the explanation that requires no AI at all.
 *
 * This is what the user sees when no key is configured, the model is down, or
 * the generated text fails the guardrails. It is assembled from the same
 * calculated facts, so it can never disagree with the numbers on screen.
 */

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const decimal = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 1 });

function explainAnalysis(facts: AnalysisFacts): string {
  if (facts.onsiteDaysPerWeek === 0) {
    return `${facts.jobTitle} at ${facts.company} has no onsite days, so there is no recurring commute cost or commute time to subtract. The estimated take-home pay of ${peso.format(facts.estimatedTakeHomePay)} a month is what remains.`;
  }

  return [
    `Going onsite ${facts.onsiteDaysPerWeek} day${facts.onsiteDaysPerWeek === 1 ? "" : "s"} a week costs about ${peso.format(facts.monthlyCommuteCost)} a month in fares and ${decimal.format(facts.monthlyCommuteHours)} hours of travel.`,
    `That is ${decimal.format(facts.commuteBurdenPercentage)}% of the estimated take-home pay, leaving ${peso.format(facts.incomeAfterCommute)} a month.`,
    `Counting commute time alongside work hours, the offer works out to about ${peso.format(facts.effectiveHourlyValue)} per hour.`,
    `Take-home pay is an estimate, and transit values come from ${facts.provenanceLabels.join(" and ").toLowerCase() || "curated demo data"}.`,
  ].join(" ");
}

function explainComparison(facts: ComparisonFacts): string {
  const { deltas, jobA, jobB } = facts;
  const salaryDirection = deltas.monthlySalary >= 0 ? "more" : "less";
  const incomeDirection = deltas.incomeAfterCommute >= 0 ? "more" : "less";

  return [
    `${jobB.jobTitle} at ${jobB.company} pays ${peso.format(Math.abs(deltas.monthlySalary))} ${salaryDirection} a month than ${jobA.jobTitle} at ${jobA.company}.`,
    `After commute costs, the gap is ${peso.format(Math.abs(deltas.incomeAfterCommute))} ${incomeDirection}.`,
    `The commute differs by ${peso.format(Math.abs(deltas.monthlyCommuteCost))} and ${decimal.format(Math.abs(deltas.monthlyCommuteHours))} hours a month.`,
    "Both figures come from the same calculation, so the difference is the commute, not the method.",
  ].join(" ");
}

export function buildDeterministicExplanation(facts: ExplanationFacts): string {
  return facts.kind === "comparison" ? explainComparison(facts) : explainAnalysis(facts);
}
