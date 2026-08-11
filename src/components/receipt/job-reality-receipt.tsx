import { summarizeProvenance } from "@/data/demo";
import type { JobRealityAnalysis } from "@/domain/models";

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

/**
 * [ASSUMPTION] `summarizeProvenance` returns null when the analysis carried no
 * sources, which happens for a fully remote offer: no commute is routed, so no
 * transit source exists. The receipt still shows an estimated take-home figure,
 * so it stays labelled as an estimate rather than silently losing its badge.
 */
const NO_COMMUTE_DISCLOSURE = "Take-home pay is estimated. This offer has no onsite commute.";

interface JobRealityReceiptProps {
  analysis: JobRealityAnalysis;
}

/**
 * Renders a completed analysis as the Commute Reality Receipt.
 *
 * Display only: every number here is read straight off `analysis`. This
 * component must never derive a business metric — formatting a value is fine,
 * computing one is not, because the deterministic engines are the only place
 * allowed to do that.
 */
export function JobRealityReceipt({ analysis }: JobRealityReceiptProps) {
  const provenance = summarizeProvenance(analysis.sources);

  return (
    <section
      className="mx-auto w-full max-w-[440px] border-t-[10px] border-accent bg-paper p-8 [overflow-wrap:anywhere] shadow-[0_24px_80px_rgba(16,42,43,0.16)] wide:mx-0 wide:max-w-none print:mx-auto print:w-[80mm] print:max-w-full print:shadow-none"
      aria-label="Commute Reality Receipt"
    >
      <header className="text-center tracking-[0.12em]">
        <p className="font-black">COMMUTE LENS</p>
        <h2 className="text-base">JOB REALITY RECEIPT</h2>
      </header>
      <div className="my-5 border-t border-dashed border-ink" />
      <h3 className="mb-[0.2rem]">{analysis.jobOffer.title}</h3>
      <p className="mt-0 text-muted">
        {analysis.jobOffer.company} — {analysis.jobOffer.officeLocation.label}
      </p>
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
        <dt>Gross salary</dt>
        <dd className="text-right tabular-nums">{peso.format(analysis.jobOffer.monthlySalary)}</dd>
        <dt>Est. take-home</dt>
        <dd className="text-right tabular-nums">{peso.format(analysis.estimatedTakeHomePay)}</dd>
        <dt>Round trip</dt>
        <dd className="text-right tabular-nums">{peso.format(analysis.commute.dailyFare)}</dd>
        <dt>Monthly transport</dt>
        <dd className="text-right tabular-nums">−{peso.format(analysis.commute.monthlyFare)}</dd>
        <dt>Monthly commute</dt>
        <dd className="text-right tabular-nums">{analysis.monthlyCommuteHours.toFixed(1)} hrs</dd>
      </dl>
      <div className="my-5 border-t border-dashed border-ink" />
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 font-black">
        <dt>Income after commute</dt>
        <dd className="text-right tabular-nums">{peso.format(analysis.incomeAfterCommute)}</dd>
      </dl>
      <p className="bg-mint p-4 text-center font-extrabold">
        {analysis.commuteBurdenPercentage.toFixed(1)}% of estimated take-home pay
      </p>
      <p className="inline-block bg-ink px-[0.6rem] py-[0.35rem] text-[0.72rem] font-black tracking-[0.1em] text-white uppercase">
        {provenance ? provenance.weakest.shortLabel : "Estimated"}
      </p>
      <small className="block leading-normal text-muted">
        {provenance ? provenance.weakest.disclosure : NO_COMMUTE_DISCLOSURE} Not payroll, tax, or
        financial advice.
        {provenance && provenance.sourceNames.length > 0
          ? ` Sources: ${provenance.sourceNames.join(", ")}.`
          : null}
      </small>
    </section>
  );
}
