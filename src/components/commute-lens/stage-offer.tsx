"use client";

import { ArrowLeft, ArrowRight, ChevronDown, Info } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ActionButton } from "@/components/ui/action-button";
import { CurrencyField, FormAlert, TextField, UnitField } from "@/components/ui/fields";
import { Eyebrow, SectionHeading } from "@/components/ui/typography";
import { calculateCommute } from "@/domain/commute/calculations";
import { DEFAULT_PAYROLL_DEDUCTIONS } from "@/domain/finance/philippine-payroll";
import type { CommuteRoute, Location } from "@/domain/models";
import { DEFAULT_HYBRID_SCHEDULE, countOnsiteDays, countWorkingDays } from "@/domain/work-schedule";
import { formatMinutes, formatNumber, formatPeso, shortPlace } from "./format";
import { PayrollDeductionSelector } from "./payroll-deduction-selector";
import {
  firstErrorField,
  summariseErrors,
  validateOfferDraft,
  type OfferDraft,
  type OfferField,
} from "./offer-validation";
import { describeRouteStatus } from "./provenance";
import { RouteStatusBadge } from "./route-status-badge";
import { WeeklyScheduleEditor } from "./weekly-schedule-editor";

/**
 * Stage three. Four named sections, one question per line, and inline
 * validation that only speaks once the user has had a chance to answer.
 */
export function OfferDetailsStage({
  idPrefix,
  origin,
  destination,
  route,
  draft,
  onDraftChange,
  serverError,
  onBack,
  onSubmit,
}: {
  idPrefix: string;
  origin: Location;
  destination: Location;
  route: CommuteRoute | null;
  draft: OfferDraft;
  onDraftChange: (patch: Partial<OfferDraft>) => void;
  serverError: string | null;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const [touched, setTouched] = useState<readonly OfferField[]>([]);
  const [attempted, setAttempted] = useState(false);

  const errors = validateOfferDraft(draft);
  const status = describeRouteStatus(route);

  function errorFor(field: OfferField) {
    return attempted || touched.includes(field) ? errors[field] : undefined;
  }

  function markTouched(field: OfferField) {
    setTouched((current) => (current.includes(field) ? current : [...current, field]));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setAttempted(true);
    const firstInvalid = firstErrorField(errors);
    if (firstInvalid) {
      document.getElementById(`${idPrefix}-${firstInvalid}`)?.focus();
      return;
    }
    onSubmit();
  }

  const summary = attempted ? summariseErrors(errors) : null;

  const weeklySchedule = draft.weeklySchedule ?? { ...DEFAULT_HYBRID_SCHEDULE };
  const onsiteDays = countOnsiteDays(weeklySchedule);
  const workingDays = countWorkingDays(weeklySchedule);
  const officeDaysPerMonth = calculateCommute(route, onsiteDays).officeDaysPerMonth;
  const salaryValue = Number(draft.salary);
  const payrollDeductions = draft.payrollDeductions ?? DEFAULT_PAYROLL_DEDUCTIONS;

  return (
    <div className="mx-auto grid max-w-5xl gap-8 pt-6 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,1.4fr)] lg:gap-12 lg:pt-10">
      <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
        <button type="button" className="back-link" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden="true" /> {route ? "Back to route" : "Back"}
        </button>
        <Eyebrow className="mt-5">Step three · the offer</Eyebrow>
        <h1 className="mt-3 font-headline text-[clamp(2rem,4.5vw,3.2rem)] leading-[0.94] font-black tracking-[-0.045em]">
          Now tell us what they are{" "}
          <span className="font-highlight font-normal text-accent italic">offering.</span>
        </h1>

        <div className="app-panel mt-6 p-5">
          <Eyebrow>Trip on file</Eyebrow>
          <div className="mt-3.5">
            <div className="trip-leg" data-kind="origin">
              <span className="trip-leg-node" aria-hidden="true" />
              <p className="text-[0.6rem] font-black tracking-[0.14em] text-muted uppercase">
                From
              </p>
              <p className="mt-0.5 text-sm font-bold break-words">{shortPlace(origin.label)}</p>
            </div>
            <div className="trip-leg" data-kind="destination">
              <span className="trip-leg-node" aria-hidden="true" />
              <p className="text-[0.6rem] font-black tracking-[0.14em] text-muted uppercase">
                Office
              </p>
              <p className="mt-0.5 text-sm font-bold break-words">
                {shortPlace(destination.label)}
              </p>
            </div>
          </div>
          <div className="mt-4 border-t border-ink/10 pt-4">
            {route ? (
              <p className="numeric text-sm font-bold">
                {formatMinutes(route.oneWayDurationMinutes)} · {formatPeso(route.oneWayFare)} one
                way
              </p>
            ) : (
              <p className="text-sm font-bold">No commute priced</p>
            )}
            <div className="mt-2.5">
              <RouteStatusBadge status={status} />
            </div>
          </div>
        </div>
      </aside>

      <form onSubmit={handleSubmit} className="app-panel min-w-0 p-5 sm:p-8" noValidate>
        {/* 1 — Role */}
        <SectionHeading step={1} title="The role" />
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <TextField
            id={`${idPrefix}-title`}
            label="Job title"
            value={draft.title}
            onChange={(title) => onDraftChange({ title })}
            onBlur={() => markTouched("title")}
            error={errorFor("title")}
            placeholder="Software Developer"
          />
          <TextField
            id={`${idPrefix}-company`}
            label="Company"
            value={draft.company}
            onChange={(company) => onDraftChange({ company })}
            onBlur={() => markTouched("company")}
            error={errorFor("company")}
            placeholder="Where you would work"
          />
        </div>

        {/* 2 — Compensation */}
        <hr className="my-8 border-ink/10" />
        <SectionHeading
          step={2}
          title="Compensation and deductions"
          description="Enter the advertised salary, then match the Philippine employee deductions included in the offer."
        />
        <div className="mt-5 grid gap-5">
          <CurrencyField
            id={`${idPrefix}-salary`}
            label="Gross monthly salary"
            value={draft.salary}
            onChange={(salary) => onDraftChange({ salary })}
            onBlur={() => markTouched("salary")}
            error={errorFor("salary")}
            hint={
              salaryValue > 0 && !errors.salary
                ? `${formatPeso(salaryValue)} before employee deductions.`
                : "The headline figure on the offer, before employee deductions."
            }
          />
          <PayrollDeductionSelector
            salary={!errors.salary && salaryValue > 0 ? salaryValue : 0}
            value={payrollDeductions}
            onChange={(payrollDeductions) => onDraftChange({ payrollDeductions })}
          />
        </div>

        {/* 3 — Work schedule */}
        <hr className="my-8 border-ink/10" />
        <SectionHeading
          step={3}
          title="Work schedule"
          description="How often you travel decides how much of the salary the commute takes."
        />
        <div className="mt-5 grid gap-5">
          <WeeklyScheduleEditor
            value={weeklySchedule}
            onChange={(weeklySchedule) => onDraftChange({ weeklySchedule })}
          />
          <p className="rounded-[1rem] bg-mint/35 p-3 text-xs leading-relaxed text-muted">
            <strong className="font-black text-ink">
              {onsiteDays} onsite · {workingDays - onsiteDays} WFH · {7 - workingDays} off
            </strong>
            <span className="numeric block mt-1">
              ≈ {formatNumber(officeDaysPerMonth)} office trips per month before return journeys.
            </span>
          </p>
          <UnitField
            id={`${idPrefix}-workingHours`}
            label="Paid hours per day"
            unit="hrs"
            value={draft.workingHours}
            onChange={(workingHours) => onDraftChange({ workingHours })}
            onBlur={() => markTouched("workingHours")}
            error={errorFor("workingHours")}
            hint="Used for effective hourly value, alongside your commute hours."
          />
        </div>

        {/* 4 — Assumptions */}
        <hr className="my-8 border-ink/10" />
        <SectionHeading
          step={4}
          title="Assumptions"
          description="Nothing here is hidden from you. Open it any time."
        />
        <div className="app-inset mt-5 p-4 sm:p-5">
          <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
            <Info className="mt-0.5 size-3.5 shrink-0 text-flame" aria-hidden="true" />
            <span>{status.disclosure}</span>
          </p>
          <details className="mt-3 border-t border-ink/10 pt-3">
            <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-xs font-black tracking-[0.08em] uppercase">
              How the numbers are calculated
              <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
            </summary>
            <ul className="space-y-2 pb-1 text-xs leading-relaxed text-muted">
              <li>
                Monthly transport = one-way fare × 2 × office days a week × 52 ÷ 12. Fares are
                estimated from typical bands, never ticketed prices.
              </li>
              <li>
                Commute time is never subtracted from your cash. It appears only in effective hourly
                value, which divides money by paid hours plus commute hours.
              </li>
              <li>
                Take-home uses the selected Philippine employee deductions and current published
                contribution/tax tables. It remains an estimate because actual payroll can include
                bonuses, loans, allowances, and employer-specific rounding.
              </li>
            </ul>
          </details>
        </div>

        {(summary || serverError) && (
          <div className="mt-7">
            <FormAlert>{serverError ?? summary}</FormAlert>
          </div>
        )}

        <ActionButton type="submit" className="mt-7 w-full">
          Show me the reality
          <ArrowRight className="size-4" aria-hidden="true" />
        </ActionButton>
      </form>
    </div>
  );
}
