import { ArrowUpRight, Equal, Target, WalletCards } from "lucide-react";
import { minimumRequiredGrossSalary } from "@/domain/finance/calculations";
import { calculateJobBMatchBreakEvenSalary } from "@/domain/job/break-even";
import type { JobRealityAnalysis, JobRealityComparison } from "@/domain/models";
import { formatPeso, formatPesoDelta } from "./format";

/** A cash-only threshold; commute time remains visible in effective hourly value. */
export function BreakEvenCard({
  analysis,
  monthlyCommuteFare,
  scenarioDays,
}: {
  analysis: JobRealityAnalysis;
  monthlyCommuteFare: number;
  scenarioDays: number;
}) {
  const estimatedTakeHomeRate = analysis.jobOffer.estimatedTakeHomeRate ?? 0.9;
  const minimumGrossMonthlySalary = minimumRequiredGrossSalary({
    monthlyCommuteFare,
    estimatedTakeHomeRate,
    payrollDeductions: analysis.jobOffer.payrollDeductions,
  });
  const deltaFromCurrent = minimumGrossMonthlySalary - analysis.jobOffer.monthlySalary;

  return (
    <section className="app-panel p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[0.62rem] font-black tracking-[0.14em] text-muted uppercase">
            <Target className="size-3.5 text-flame" aria-hidden="true" /> Cash break-even
          </p>
          <h2 className="mt-2 font-headline text-xl leading-tight font-black tracking-[-0.025em]">
            Gross salary needed to leave ₱0 after transport
          </h2>
        </div>
        <WalletCards className="size-5 text-flame" aria-hidden="true" />
      </div>
      <p className="numeric mt-5 font-headline text-[clamp(2.15rem,5vw,3.1rem)] leading-none font-black tracking-[-0.05em] text-flame">
        {formatPeso(minimumGrossMonthlySalary)}/mo
      </p>
      <p className="mt-3 max-w-2xl text-[0.76rem] leading-relaxed text-muted">
        {deltaFromCurrent > 0
          ? `That is ${formatPeso(deltaFromCurrent)} above the advertised salary.`
          : `The advertised salary is ${formatPeso(Math.abs(deltaFromCurrent))} above this cash-only floor.`}{" "}
        Based on {scenarioDays} office day{scenarioDays === 1 ? "" : "s"} a week and{" "}
        {formatPeso(monthlyCommuteFare)} monthly transport. The salary floor re-runs the selected{" "}
        {analysis.jobOffer.payrollDeductions
          ? "Philippine employee deductions at each candidate salary."
          : `${Math.round(estimatedTakeHomeRate * 100)}% legacy take-home estimate.`}
      </p>
      <p className="mt-3 flex items-start gap-2 border-t border-ink/10 pt-3 text-[0.68rem] leading-relaxed text-muted">
        <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-leaf" aria-hidden="true" />
        This is a minimum cash threshold, not a pay recommendation. Commute time is intentionally
        excluded here and remains reflected in effective hourly value.
      </p>
    </section>
  );
}

export function ComparisonBreakEvenCard({ comparison }: { comparison: JobRealityComparison }) {
  const result = calculateJobBMatchBreakEvenSalary(comparison);
  const alreadyMatches = result.grossSalaryDeltaFromCurrent <= 0;

  return (
    <section className="mint-panel p-5 sm:p-6">
      <p className="flex items-center gap-2 text-[0.62rem] font-black tracking-[0.14em] text-ink/65 uppercase">
        <Equal className="size-3.5" aria-hidden="true" /> Cash-equivalent salary
      </p>
      <h2 className="mt-2 max-w-2xl font-headline text-xl leading-tight font-black tracking-[-0.025em]">
        Job B needs {formatPeso(result.minimumGrossMonthlySalary)}/month to match Job A&apos;s cash
        after transport.
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-ink/75">
        {alreadyMatches
          ? `Job B already clears that threshold by ${formatPeso(Math.abs(result.grossSalaryDeltaFromCurrent))}.`
          : `That is ${formatPesoDelta(result.grossSalaryDeltaFromCurrent)} from Job B’s current advertised salary.`}
      </p>
      <p className="mt-3 text-[0.68rem] leading-relaxed text-ink/60">
        This compares monthly cash after each commute using Job B&apos;s own take-home estimate and
        fare. It does not price the time difference.
      </p>
    </section>
  );
}
