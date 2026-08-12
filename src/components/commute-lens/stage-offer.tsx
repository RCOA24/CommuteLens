"use client";

import {
  ArrowLeft,
  ArrowRight,
  Blend,
  Building2,
  ChevronDown,
  House,
  Info,
  Sparkles,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { ActionButton } from "@/components/ui/action-button";
import { ChoiceGroup, DayCountGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { CurrencyField, FormAlert, TextField, UnitField } from "@/components/ui/fields";
import { Eyebrow, SectionHeading } from "@/components/ui/typography";
import { calculateCommute } from "@/domain/commute/calculations";
import { estimateTakeHomePay } from "@/domain/finance/calculations";
import type { CommuteRoute, Location, WorkArrangement } from "@/domain/models";
import { formatMinutes, formatNumber, formatPeso, shortPlace } from "./format";
import {
  firstErrorField,
  summariseErrors,
  validateOfferDraft,
  type OfferDraft,
  type OfferField,
} from "./offer-validation";
import { describeRouteStatus } from "./provenance";
import { RouteStatusBadge } from "./route-status-badge";

const ARRANGEMENT_OPTIONS: readonly ChoiceOption<WorkArrangement>[] = [
  { value: "remote", title: "Remote", note: "No office days.", icon: <House /> },
  { value: "hybrid", title: "Hybrid", note: "A few office days.", icon: <Blend /> },
  { value: "onsite", title: "Onsite", note: "Every working day.", icon: <Building2 /> },
];

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
  arrangement,
  onArrangementChange,
  onsiteDays,
  onOnsiteDaysChange,
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
  arrangement: WorkArrangement;
  onArrangementChange: (arrangement: WorkArrangement) => void;
  onsiteDays: number;
  onOnsiteDaysChange: (days: number) => void;
  serverError: string | null;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const [touched, setTouched] = useState<readonly OfferField[]>([]);
  const [attempted, setAttempted] = useState(false);

  const errors = validateOfferDraft(draft);
  const isRemote = arrangement === "remote";
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

  /*
   * Both previews come from the domain layer rather than from arithmetic here:
   * `calculateCommute` owns the weeks-per-month assumption and
   * `estimateTakeHomePay` owns the rate band. The UI only decides when it is
   * safe to render them.
   */
  const officeDaysPerMonth = calculateCommute(route, isRemote ? 0 : onsiteDays).officeDaysPerMonth;
  const takeHomeRate = Number(draft.takeHomePercent) / 100;
  const salaryValue = Number(draft.salary);
  const canPreviewTakeHome =
    !errors.salary && !errors.takeHomePercent && salaryValue > 0 && takeHomeRate >= 0.5;
  const takeHomePreview = canPreviewTakeHome
    ? estimateTakeHomePay(salaryValue, takeHomeRate)
    : null;

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
          title="Compensation"
          description="The advertised number, plus your own estimate of what actually reaches your account."
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
                ? `${formatPeso(salaryValue)} before deductions.`
                : "The headline figure on the offer, before deductions."
            }
          />
          <div className="app-inset p-4 sm:p-5">
            <div className="grid gap-5 sm:grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] sm:items-start">
              <UnitField
                id={`${idPrefix}-takeHomePercent`}
                label="Take-home"
                unit="%"
                value={draft.takeHomePercent}
                onChange={(takeHomePercent) => onDraftChange({ takeHomePercent })}
                onBlur={() => markTouched("takeHomePercent")}
                error={errorFor("takeHomePercent")}
              />
              <div className="min-w-0 text-xs leading-relaxed text-muted">
                <p>
                  The share of gross pay that lands in your account after SSS, PhilHealth, Pag-IBIG,
                  and withholding tax. Move it to match your latest payslip.
                </p>
                {takeHomePreview !== null && (
                  <p className="mt-2.5 flex items-center gap-1.5 text-sm font-bold text-ink">
                    <Sparkles className="size-3.5 shrink-0 text-flame" aria-hidden="true" />
                    <span className="numeric">
                      ≈ {formatPeso(takeHomePreview)} estimated take-home
                    </span>
                  </p>
                )}
                <p className="mt-2 text-[0.68rem]">
                  This is your estimate, not a tax computation. Commute Lens does not file anything
                  for you.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 3 — Work schedule */}
        <hr className="my-8 border-ink/10" />
        <SectionHeading
          step={3}
          title="Work schedule"
          description="How often you travel decides how much of the salary the commute takes."
        />
        <div className="mt-5 grid gap-5">
          <ChoiceGroup
            name={`${idPrefix}-offer-arrangement`}
            legend="Work arrangement"
            value={arrangement}
            options={ARRANGEMENT_OPTIONS}
            onChange={onArrangementChange}
          />
          {isRemote ? (
            <p className="flex items-start gap-2.5 rounded-[1.1rem] border border-leaf/25 bg-leaf/8 p-3.5 text-xs leading-relaxed">
              <House className="mt-0.5 size-4 shrink-0 text-leaf" aria-hidden="true" />
              <span>
                Remote means zero office days, so transport cost and commute time are both zero. You
                can still try onsite weeks in the scenario explorer after calculating.
              </span>
            </p>
          ) : (
            <DayCountGroup
              name={`${idPrefix}-onsite-days`}
              legend="Office days per week"
              value={onsiteDays}
              onChange={onOnsiteDaysChange}
              hint={
                <span className="numeric">
                  ≈ {formatNumber(officeDaysPerMonth)} office days a month.
                </span>
              }
            />
          )}
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
                Take-home uses the percentage you set above. It is a disclosed estimate, not a
                payroll or tax calculation.
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
