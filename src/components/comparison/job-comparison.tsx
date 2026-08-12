import { summarizeProvenance } from "@/data/demo";
import type { ComparedMetric, JobRealityComparison } from "@/domain/models";

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const pesoDecimal = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Direction of "better" per metric. difference is always jobB - jobA.
 * "higher" means B wins when difference > 0.
 * "lower" means B wins when difference < 0.
 */
type Direction = "higher" | "lower";

interface MetricConfig {
  key: keyof JobRealityComparison["metrics"];
  label: string;
  direction: Direction;
  format: (value: number) => string;
  /**
   * How to render the gap between the two offers, when that reads differently
   * from the value itself. A burden of 12% minus a burden of 9% is 3
   * percentage points, not 3%, so the difference column needs its own unit.
   */
  formatDelta?: (value: number) => string;
  /** Emphasise this row visually — these are the product's point. */
  emphasize?: boolean;
}

const METRICS: MetricConfig[] = [
  {
    key: "monthlySalary",
    label: "Monthly Salary",
    direction: "higher",
    format: (v) => peso.format(v),
  },
  {
    key: "estimatedTakeHomePay",
    label: "Est. Take-Home",
    direction: "higher",
    format: (v) => peso.format(v),
  },
  {
    key: "monthlyCommuteCost",
    label: "Monthly Commute Cost",
    direction: "lower",
    format: (v) => peso.format(v),
  },
  {
    key: "monthlyCommuteHours",
    label: "Monthly Commute Hours",
    direction: "lower",
    format: (v) => `${v.toFixed(1)} hrs`,
  },
  {
    key: "incomeAfterCommute",
    label: "Income After Commute",
    direction: "higher",
    format: (v) => peso.format(v),
    emphasize: true,
  },
  {
    key: "commuteBurdenPercentage",
    label: "Commute Burden",
    direction: "lower",
    format: (v) => `${v.toFixed(1)}%`,
    formatDelta: (v) => `${v.toFixed(1)} pts`,
  },
  {
    key: "effectiveHourlyValue",
    label: "Effective Hourly Value",
    direction: "higher",
    format: (v) => `${pesoDecimal.format(v)}/hr`,
    emphasize: true,
  },
];

function getWinner(metric: ComparedMetric, direction: Direction): "a" | "b" | "tie" {
  if (metric.difference === 0) return "tie";
  if (direction === "higher") return metric.difference > 0 ? "b" : "a";
  return metric.difference < 0 ? "b" : "a";
}

function formatDifference(value: number, config: MetricConfig): string {
  if (value === 0) return "—";
  const format = config.formatDelta ?? config.format;
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${format(value)}`;
}

/**
 * [ASSUMPTION] `summarizeProvenance` returns null when neither analysis carried
 * a source, which happens when both offers are fully remote: nothing is routed,
 * so no transit source exists. The comparison still shows estimated take-home
 * figures, so it stays labelled as an estimate rather than silently dropping
 * its disclosure. Mirrors the same fallback in the receipt.
 */
const NO_COMMUTE_DISCLOSURE = "Take-home pay is estimated. Neither offer has an onsite commute.";

interface JobComparisonProps {
  comparison: JobRealityComparison;
}

/**
 * Side-by-side comparison of two job offers, showing all seven metrics with
 * per-metric winner marking. Does not compute anything — all values come
 * straight from the comparison result produced by the domain engine.
 */
export function JobComparison({ comparison }: JobComparisonProps) {
  const { jobA, jobB, metrics } = comparison;

  // Provenance: merge sources from both analyses
  const allSources = [...jobA.sources, ...jobB.sources];
  const provenance = summarizeProvenance(allSources);

  return (
    <section aria-label="Job comparison" className="w-full">
      {/* Column headers: Job A / Job B with their titles */}
      <div className="mb-6 grid grid-cols-[1fr_1fr] gap-4 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <p className="text-[0.65rem] font-bold tracking-[0.12em] text-muted uppercase">Job A</p>
          <p className="text-sm font-semibold text-ink [overflow-wrap:anywhere]">
            {jobA.jobOffer.title}
          </p>
          <p className="text-[0.78rem] text-muted [overflow-wrap:anywhere]">
            {jobA.jobOffer.company}
          </p>
        </div>
        <div>
          <p className="text-[0.65rem] font-bold tracking-[0.12em] text-muted uppercase">Job B</p>
          <p className="text-sm font-semibold text-ink [overflow-wrap:anywhere]">
            {jobB.jobOffer.title}
          </p>
          <p className="text-[0.78rem] text-muted [overflow-wrap:anywhere]">
            {jobB.jobOffer.company}
          </p>
        </div>
        {/* Difference column header — hidden on narrow screens */}
        <div className="hidden sm:block">
          <p className="text-[0.65rem] font-bold tracking-[0.12em] text-muted uppercase">Diff</p>
        </div>
      </div>

      {/* Metric rows */}
      <div className="divide-y divide-ink/8">
        {METRICS.map((config) => {
          const metric = metrics[config.key];
          const winner = getWinner(metric, config.direction);
          const isEmphasized = config.emphasize === true;

          return (
            <div
              key={config.key}
              className={`grid grid-cols-[1fr_1fr] gap-4 py-3 sm:grid-cols-[1fr_1fr_auto] ${
                isEmphasized ? "bg-mint/30 -mx-3 px-3 rounded" : ""
              }`}
            >
              {/* Job A value */}
              <div>
                <p className="text-[0.65rem] font-medium text-muted">{config.label}</p>
                <p
                  className={`text-sm tabular-nums ${
                    winner === "a"
                      ? "font-bold text-ink"
                      : winner === "b"
                        ? "text-muted"
                        : "text-ink"
                  }`}
                >
                  {config.format(metric.jobA)}
                  {winner === "a" && (
                    <>
                      <span className="ml-1 text-[0.65rem] text-accent" aria-hidden="true">
                        ●
                      </span>
                      <span className="sr-only"> — better on this measure</span>
                    </>
                  )}
                </p>
              </div>

              {/* Job B value */}
              <div>
                <p className="text-[0.65rem] font-medium text-muted sm:hidden">{config.label}</p>
                <p
                  className={`text-sm tabular-nums ${
                    winner === "b"
                      ? "font-bold text-ink"
                      : winner === "a"
                        ? "text-muted"
                        : "text-ink"
                  }`}
                >
                  {config.format(metric.jobB)}
                  {winner === "b" && (
                    <>
                      <span className="ml-1 text-[0.65rem] text-accent" aria-hidden="true">
                        ●
                      </span>
                      <span className="sr-only"> — better on this measure</span>
                    </>
                  )}
                </p>
              </div>

              {/* Difference — hidden on narrow */}
              <div className="hidden min-w-[5.5rem] text-right sm:block">
                <p
                  className={`text-sm tabular-nums ${
                    metric.difference === 0 ? "text-muted" : "text-ink/70"
                  }`}
                >
                  {formatDifference(metric.difference, config)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Provenance disclosure — renders unconditionally, see NO_COMMUTE_DISCLOSURE. */}
      <footer className="mt-6 border-t border-ink/10 pt-4">
        <span className="inline-block bg-ink px-2 py-0.5 text-[0.6rem] font-bold tracking-[0.1em] text-white uppercase">
          {provenance ? provenance.weakest.shortLabel : "Estimated"}
        </span>
        <p className="mt-2 text-[0.7rem] leading-[1.5] text-muted">
          {provenance ? provenance.weakest.disclosure : NO_COMMUTE_DISCLOSURE} Not payroll, tax, or
          financial advice.
          {provenance && provenance.sourceNames.length > 0
            ? ` Sources: ${provenance.sourceNames.join(", ")}.`
            : null}
        </p>
      </footer>
    </section>
  );
}
