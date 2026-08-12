import type { JobRealityComparison } from "@/domain/models";
import { formatHours, formatPeso } from "./format";

/**
 * Turns the comparison metrics the server already computed into words.
 *
 * Two product rules are encoded here:
 *  1. Never declare a universal winner when the measures disagree. A job that
 *     pays more cash but buys back fewer hours is a trade-off, not a loss.
 *  2. Always name the cause. "Job B leads" is useless without "because its
 *     commute costs less".
 *
 * This module reads `comparison.metrics` and does no arithmetic of its own
 * beyond taking absolute values for display.
 */

export type Leader = "A" | "B" | "tie";

/** Below these, two figures are the same number as far as a decision goes. */
const PESO_TOLERANCE = 1;
const HOURLY_TOLERANCE = 0.01;
const HOURS_TOLERANCE = 0.05;

export interface ComparisonVerdict {
  /** Who leaves more cash after transport. */
  cash: Leader;
  /** Who pays better per effective hour. */
  hourly: Leader;
  /** Who takes less time getting there. */
  commuteTime: Leader;
  agreement: "aligned" | "split" | "tie";
  headline: string;
  /** One to three sentences explaining what causes the difference. */
  tradeOff: string[];
}

/** `difference` is always jobB − jobA, so a positive value favours B. */
function higherWins(difference: number, tolerance: number): Leader {
  if (difference > tolerance) return "B";
  if (difference < -tolerance) return "A";
  return "tie";
}

function lowerWins(difference: number, tolerance: number): Leader {
  if (difference > tolerance) return "A";
  if (difference < -tolerance) return "B";
  return "tie";
}

export function buildComparisonVerdict(comparison: JobRealityComparison): ComparisonVerdict {
  const { metrics } = comparison;

  const cash = higherWins(metrics.incomeAfterCommute.difference, PESO_TOLERANCE);
  const hourly = higherWins(metrics.effectiveHourlyValue.difference, HOURLY_TOLERANCE);
  const commuteTime = lowerWins(metrics.monthlyCommuteHours.difference, HOURS_TOLERANCE);

  const agreement: ComparisonVerdict["agreement"] =
    cash !== "tie" && cash === hourly
      ? "aligned"
      : cash === "tie" && hourly === "tie"
        ? "tie"
        : "split";

  let headline: string;
  if (agreement === "aligned") {
    headline = `Job ${cash} leads on both take-home cash and hourly value.`;
  } else if (agreement === "tie") {
    headline = "These two offers land in almost the same place.";
  } else if (cash === "tie") {
    headline = `Cash lands about level, but Job ${hourly} pays better per hour.`;
  } else if (hourly === "tie") {
    headline = `Job ${cash} leaves more cash, and hourly value is about level.`;
  } else {
    headline = `No single winner: Job ${cash} leaves more cash, Job ${hourly} pays better per hour.`;
  }

  return { cash, hourly, commuteTime, agreement, headline, tradeOff: buildTradeOff(comparison) };
}

function buildTradeOff(comparison: JobRealityComparison): string[] {
  const { metrics } = comparison;
  const sentences: string[] = [];

  const salaryDifference = metrics.monthlySalary.difference;
  if (Math.abs(salaryDifference) > PESO_TOLERANCE) {
    const leader = salaryDifference > 0 ? "B" : "A";
    sentences.push(
      `Job ${leader} advertises ${formatPeso(Math.abs(salaryDifference))} more per month.`,
    );
  } else {
    sentences.push("Both offers advertise the same monthly salary.");
  }

  const costDifference = metrics.monthlyCommuteCost.difference;
  const hoursDifference = metrics.monthlyCommuteHours.difference;
  const costClause =
    Math.abs(costDifference) > PESO_TOLERANCE
      ? `costs ${formatPeso(Math.abs(costDifference))} ${costDifference > 0 ? "more" : "less"}`
      : null;
  const hoursClause =
    Math.abs(hoursDifference) > HOURS_TOLERANCE
      ? `takes ${formatHours(Math.abs(hoursDifference))} ${hoursDifference > 0 ? "longer" : "less"}`
      : null;

  if (costClause || hoursClause) {
    sentences.push(
      `Job B's commute ${[costClause, hoursClause].filter(Boolean).join(" and ")} each month.`,
    );
  } else {
    sentences.push("The two commutes cost and take about the same each month.");
  }

  const cashDifference = metrics.incomeAfterCommute.difference;
  if (Math.abs(cashDifference) > PESO_TOLERANCE) {
    const leader = cashDifference > 0 ? "B" : "A";
    sentences.push(
      `After transport, Job ${leader} leaves ${formatPeso(Math.abs(cashDifference))} more in your account each month.`,
    );
  }

  return sentences;
}

export function leaderLabel(leader: Leader): string {
  return leader === "tie" ? "Level" : `Job ${leader}`;
}
