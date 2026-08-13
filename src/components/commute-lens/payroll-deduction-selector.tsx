import { Check, ExternalLink, Landmark, ShieldCheck } from "lucide-react";
import {
  DEFAULT_PAYROLL_DEDUCTIONS,
  PH_PAYROLL_POLICY,
  estimatePhilippinePayroll,
  type PayrollDeductionId,
  type PayrollDeductionSelection,
} from "@/domain/finance/philippine-payroll";
import { formatPeso } from "./format";

export function PayrollDeductionSelector({
  salary,
  value = DEFAULT_PAYROLL_DEDUCTIONS,
  onChange,
  compact = false,
}: {
  salary: number;
  value?: PayrollDeductionSelection;
  onChange: (value: PayrollDeductionSelection) => void;
  compact?: boolean;
}) {
  const estimate = estimatePhilippinePayroll(
    Math.max(0, Number.isFinite(salary) ? salary : 0),
    value,
  );
  const amountById = new Map(estimate.deductions.map((line) => [line.id, line.amount]));

  function toggle(id: PayrollDeductionId) {
    onChange({ ...value, [id]: !value[id] });
  }

  return (
    <section className="payroll-selector" aria-labelledby={compact ? undefined : "payroll-heading"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[0.64rem] font-black tracking-[0.14em] text-leaf uppercase">
            <Landmark className="size-3.5" aria-hidden="true" /> Philippine payroll estimate
          </p>
          {!compact && (
            <>
              <h3 id="payroll-heading" className="mt-1.5 font-headline text-lg font-black">
                What will be deducted from this offer?
              </h3>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">
                All common private-employee deductions are selected. Turn off only an item that does
                not apply, or to match an actual payslip.
              </p>
            </>
          )}
        </div>
        <div className="shrink-0 rounded-[0.85rem] bg-ink px-4 py-3 text-paper sm:text-right">
          <span className="block text-[0.58rem] font-black tracking-[0.12em] text-paper/60 uppercase">
            Estimated take-home
          </span>
          <strong className="numeric mt-1 block font-headline text-xl font-black text-mint">
            {salary > 0 ? formatPeso(estimate.estimatedTakeHomePay) : "—"}
          </strong>
          {salary > 0 && (
            <span className="numeric mt-0.5 block text-[0.62rem] text-paper/60">
              −{formatPeso(estimate.totalDeductions)} deductions
            </span>
          )}
        </div>
      </div>

      <div className={`mt-4 grid gap-2 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2"}`}>
        {PH_PAYROLL_POLICY.sources.map((source) => {
          const checked = value[source.id];
          const amount = amountById.get(source.id) ?? 0;
          return (
            <label key={source.id} className="payroll-option" data-selected={checked}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(source.id)}
                aria-describedby={`payroll-${source.id}-note`}
              />
              <span className="payroll-option-check" aria-hidden="true">
                {checked && <Check className="size-3.5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-start justify-between gap-3">
                  <strong className="text-xs font-black">{source.shortLabel}</strong>
                  <span className="numeric shrink-0 text-xs font-black text-flame">
                    {salary > 0 && checked
                      ? `−${formatPeso(amount)}`
                      : checked
                        ? "Included"
                        : "Off"}
                  </span>
                </span>
                <span
                  id={`payroll-${source.id}-note`}
                  className="mt-1 block text-[0.66rem] leading-snug text-muted"
                >
                  {source.effectiveLabel}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      {!compact && (
        <div className="mt-4 flex flex-col gap-2 border-t border-ink/10 pt-3 text-[0.66rem] leading-relaxed text-muted sm:flex-row sm:items-start sm:justify-between">
          <p className="flex max-w-xl items-start gap-1.5">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-leaf" aria-hidden="true" />
            Uses employee shares and the BIR monthly table. Actual payroll may differ because of
            bonuses, taxable allowances, employer timing, rounding, loans, or other adjustments.
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 sm:justify-end">
            {PH_PAYROLL_POLICY.sources.map((source) => (
              <a
                key={source.id}
                href={source.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-bold text-leaf underline decoration-leaf/30 underline-offset-2"
              >
                {source.shortLabel}
                <ExternalLink className="size-2.5" aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
