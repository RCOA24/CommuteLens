"use client";

import { motion } from "motion/react";
import {
  ArrowLeft,
  Blend,
  Building2,
  Check,
  Clock3,
  Hourglass,
  House,
  LoaderCircle,
  Scale,
  Wallet,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { CompareJobOffersResult } from "@/application/compare-job-offers/use-case";
import { LocationSearch } from "@/components/location/location-search";
import { ActionButton } from "@/components/ui/action-button";
import { ChoiceGroup, DayCountGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { CurrencyField, FormAlert, TextField, UnitField } from "@/components/ui/fields";
import { Eyebrow } from "@/components/ui/typography";
import type {
  JobRealityAnalysis,
  JobRealityComparison,
  Location,
  WorkArrangement,
} from "@/domain/models";
import { toExplainComparisonRequest } from "@/shared/contracts/explanation";
import { ComparisonBreakEvenCard } from "./break-even-card";
import { buildComparisonVerdict, leaderLabel, type Leader } from "./comparison-narrative";
import { ExplanationPanel } from "./explanation-panel";
import { formatHours, formatPeso, scheduleLabel, shortPlace } from "./format";
import {
  firstErrorField,
  summariseErrors,
  validateOfferDraft,
  type OfferDraft,
  type OfferField,
} from "./offer-validation";

const ARRANGEMENT_OPTIONS: readonly ChoiceOption<WorkArrangement>[] = [
  { value: "remote", title: "Remote", note: "No office days.", icon: <House /> },
  { value: "hybrid", title: "Hybrid", note: "A few office days.", icon: <Blend /> },
  { value: "onsite", title: "Onsite", note: "Every working day.", icon: <Building2 /> },
];

function arrangementDays(arrangement: WorkArrangement, current: number) {
  if (arrangement === "remote") return 0;
  if (arrangement === "onsite") return 5;
  return Math.min(4, Math.max(1, current || 3));
}

/**
 * Stage five. Job B is entered independently — its own origin, office, salary,
 * arrangement, and hours — then both offers are put through the same disclosed
 * model on the server.
 */
export function ComparisonStage({
  jobA,
  reduceMotion,
  onBack,
}: {
  jobA: JobRealityAnalysis;
  reduceMotion: boolean;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState<OfferDraft>({
    title: jobA.jobOffer.title,
    company: "",
    salary: "",
    workingHours: String(jobA.jobOffer.workingHoursPerDay),
    takeHomePercent: String(Math.round((jobA.jobOffer.estimatedTakeHomeRate ?? 0.9) * 100)),
  });
  const [origin, setOrigin] = useState<Location | null>(jobA.origin);
  const [destination, setDestination] = useState<Location | null>(null);
  const [arrangement, setArrangement] = useState<WorkArrangement>("hybrid");
  const [onsiteDays, setOnsiteDays] = useState(2);
  const [comparison, setComparison] = useState<JobRealityComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState<readonly OfferField[]>([]);

  const errors = validateOfferDraft(draft);
  const isRemote = arrangement === "remote";

  function errorFor(field: OfferField) {
    return attempted || touched.includes(field) ? errors[field] : undefined;
  }

  function markTouched(field: OfferField) {
    setTouched((current) => (current.includes(field) ? current : [...current, field]));
  }

  function patch(next: Partial<OfferDraft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function selectArrangement(next: WorkArrangement) {
    setArrangement(next);
    setOnsiteDays(arrangementDays(next, onsiteDays));
  }

  async function compare() {
    setAttempted(true);
    const firstInvalid = firstErrorField(errors);
    if (firstInvalid) {
      document.getElementById(`compare-${firstInvalid}`)?.focus();
      return;
    }
    if (!origin || !destination) {
      setError("Choose both a starting point and an office for Job B from the search results.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/commute/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobA: {
            origin: jobA.origin,
            route: jobA.commute.route,
            discountClass: jobA.fareDiscountClass,
            jobOffer: jobA.jobOffer,
          },
          jobB: {
            // Fare class belongs to the commuter, not the offer, so Job B is
            // priced with the same entitlement rather than at full fare.
            discountClass: jobA.fareDiscountClass,
            origin,
            jobOffer: {
              id: `compare-${crypto.randomUUID()}`,
              title: draft.title.trim(),
              company: draft.company.trim(),
              monthlySalary: Number(draft.salary),
              officeLocation: destination,
              workArrangement: arrangement,
              onsiteDaysPerWeek: onsiteDays,
              workingHoursPerDay: Number(draft.workingHours),
              estimatedTakeHomeRate: Number(draft.takeHomePercent) / 100,
            },
          },
        }),
      });
      const result = (await response.json()) as CompareJobOffersResult;
      if (result.success) setComparison(result.data);
      else setError(result.error.message);
    } catch {
      setError("Could not compare the offers. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  const jobB = comparison?.jobB ?? null;
  const verdict = comparison ? buildComparisonVerdict(comparison) : null;
  const summary = attempted ? summariseErrors(errors) : null;

  return (
    <div className="mx-auto max-w-5xl pt-6 lg:pt-10">
      <button type="button" className="back-link" onClick={onBack}>
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to your result
      </button>

      <header className="mt-5">
        <Eyebrow>Step five · side by side</Eyebrow>
        <h1 className="mt-3 max-w-2xl font-headline text-[clamp(2rem,5.5vw,3.6rem)] leading-[0.94] font-black tracking-[-0.05em]">
          Compare the money{" "}
          <span className="font-highlight font-normal text-accent italic">and the time.</span>
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          Job B gets its own origin, office, schedule, and hours. Both offers then go through the
          same disclosed model, so the difference you see is real.
        </p>
      </header>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {/* Job A — already known */}
        <section className="app-panel p-5 sm:p-7">
          <span className="compare-label">Job A · yours</span>
          <h2 className="mt-5 font-headline text-xl leading-tight font-black break-words">
            {jobA.jobOffer.title}
          </h2>
          <p className="mt-1 text-sm text-muted break-words">{jobA.jobOffer.company}</p>
          <p className="numeric mt-6 font-headline text-[clamp(2rem,5vw,2.75rem)] leading-none font-black tracking-[-0.045em]">
            {formatPeso(jobA.jobOffer.monthlySalary)}
          </p>
          <p className="mt-1 text-[0.68rem] font-black tracking-[0.12em] text-muted uppercase">
            Advertised monthly salary
          </p>
          <dl className="mt-6 space-y-2.5 border-t border-ink/10 pt-4 text-sm">
            <SummaryRow label="Office" value={shortPlace(jobA.jobOffer.officeLocation.label)} />
            <SummaryRow label="Schedule" value={scheduleLabel(jobA.jobOffer.onsiteDaysPerWeek)} />
            <SummaryRow
              label="Cash after transport"
              value={formatPeso(jobA.incomeAfterCommute)}
              strong
            />
            <SummaryRow label="Commute time" value={formatHours(jobA.monthlyCommuteHours)} />
          </dl>
        </section>

        {/* Job B — the offer being weighed */}
        <section className="app-panel p-5 sm:p-7">
          <span className="compare-label" data-variant="b">
            Job B · the other offer
          </span>
          <div className="mt-5 grid gap-5">
            <TextField
              id="compare-title"
              label="Job title"
              value={draft.title}
              onChange={(title) => patch({ title })}
              onBlur={() => markTouched("title")}
              error={errorFor("title")}
            />
            <TextField
              id="compare-company"
              label="Company"
              value={draft.company}
              onChange={(company) => patch({ company })}
              onBlur={() => markTouched("company")}
              error={errorFor("company")}
              placeholder="The other company"
            />
            <CurrencyField
              id="compare-salary"
              label="Gross monthly salary"
              value={draft.salary}
              onChange={(salary) => patch({ salary })}
              onBlur={() => markTouched("salary")}
              error={errorFor("salary")}
            />
            <div className="trip-rail">
              <div className="trip-leg" data-kind="origin">
                <span className="trip-leg-node" aria-hidden="true" />
                <LocationSearch
                  value={origin}
                  onChange={setOrigin}
                  label="FROM"
                  placeholder="Where you would start"
                  idPrefix="compare-origin"
                />
              </div>
              <div className="trip-leg" data-kind="destination">
                <span className="trip-leg-node" aria-hidden="true" />
                <LocationSearch
                  value={destination}
                  onChange={setDestination}
                  label="OFFICE"
                  placeholder="Where this office is"
                  idPrefix="compare-destination"
                  showCurrentLocation={false}
                />
              </div>
            </div>
            <ChoiceGroup
              name="compare-arrangement"
              legend="Work arrangement"
              value={arrangement}
              options={ARRANGEMENT_OPTIONS}
              onChange={selectArrangement}
            />
            {!isRemote && (
              <DayCountGroup
                name="compare-onsite-days"
                legend="Office days per week"
                value={onsiteDays}
                onChange={setOnsiteDays}
              />
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <UnitField
                id="compare-workingHours"
                label="Paid hours per day"
                unit="hrs"
                value={draft.workingHours}
                onChange={(workingHours) => patch({ workingHours })}
                onBlur={() => markTouched("workingHours")}
                error={errorFor("workingHours")}
              />
              <UnitField
                id="compare-takeHomePercent"
                label="Take-home"
                unit="%"
                value={draft.takeHomePercent}
                onChange={(takeHomePercent) => patch({ takeHomePercent })}
                onBlur={() => markTouched("takeHomePercent")}
                error={errorFor("takeHomePercent")}
              />
            </div>
            {(summary || error) && <FormAlert>{error ?? summary}</FormAlert>}
            <ActionButton onClick={() => void compare()} disabled={loading}>
              {loading ? (
                <>
                  <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
                  Comparing…
                </>
              ) : (
                <>
                  <Scale className="size-4" aria-hidden="true" />
                  Compare both offers
                </>
              )}
            </ActionButton>
          </div>
        </section>
      </div>

      {comparison && jobB && verdict && (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 grid gap-5"
          aria-live="polite"
        >
          {/* The verdict, stated without pretending the measures agree. */}
          <section className="ink-panel on-ink p-6 sm:p-8">
            <Eyebrow tone="mint">
              {verdict.agreement === "aligned"
                ? "One offer leads"
                : verdict.agreement === "tie"
                  ? "Almost level"
                  : "A trade-off, not a winner"}
            </Eyebrow>
            <h2 className="mt-3 max-w-2xl font-headline text-[clamp(1.5rem,3.6vw,2.25rem)] leading-tight font-black tracking-[-0.035em]">
              {verdict.headline}
            </h2>
            <ul className="mt-5 max-w-2xl space-y-1.5 text-sm leading-relaxed text-paper/75">
              {verdict.tradeOff.map((sentence) => (
                <li key={sentence}>{sentence}</li>
              ))}
            </ul>
            <dl className="mt-7 grid gap-4 border-t border-paper/15 pt-5 sm:grid-cols-3">
              <LeaderCallout icon={<Wallet />} label="More monthly cash" leader={verdict.cash} />
              <LeaderCallout
                icon={<Hourglass />}
                label="Better hourly value"
                leader={verdict.hourly}
              />
              <LeaderCallout
                icon={<Clock3 />}
                label="Less commute time"
                leader={verdict.commuteTime}
              />
            </dl>
          </section>

          <section className="app-panel p-5 sm:p-7">
            <Eyebrow>Measure by measure</Eyebrow>
            <div className="mt-6 grid gap-8">
              <CompareRow
                label="Cash after transport"
                note="Higher is better"
                leader={verdict.cash}
                reduceMotion={reduceMotion}
                aValue={jobA.incomeAfterCommute}
                bValue={jobB.incomeAfterCommute}
                aAdvertised={jobA.jobOffer.monthlySalary}
                bAdvertised={jobB.jobOffer.monthlySalary}
                format={formatPeso}
              />
              <CompareRow
                label="Effective hourly value, including commute time"
                note="Higher is better"
                leader={verdict.hourly}
                reduceMotion={reduceMotion}
                aValue={jobA.effectiveHourlyValue}
                bValue={jobB.effectiveHourlyValue}
                format={(value) => `${formatPeso(value)}/hr`}
              />
              <CompareRow
                label="Monthly commute time"
                note="Lower is better"
                leader={verdict.commuteTime}
                reduceMotion={reduceMotion}
                aValue={jobA.monthlyCommuteHours}
                bValue={jobB.monthlyCommuteHours}
                format={formatHours}
              />
            </div>
            <p className="mt-7 border-t border-ink/10 pt-4 text-[0.72rem] leading-relaxed text-muted">
              Both offers use the same estimated fares, the same weeks-per-month assumption, and
              each offer&apos;s own take-home percentage. Bars show magnitude, and the leader is
              marked in words as well as colour.
            </p>
          </section>

          <ComparisonBreakEvenCard comparison={comparison} />

          <ExplanationPanel
            prompt="Get a short read on which trade-off this comparison is really asking you to make."
            payload={toExplainComparisonRequest(comparison)}
          />
        </motion.div>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className={`numeric shrink-0 text-right ${strong ? "font-black" : "font-bold"}`}>
        {value}
      </dd>
    </div>
  );
}

function LeaderCallout({
  icon,
  label,
  leader,
}: {
  icon: ReactNode;
  label: string;
  leader: Leader;
}) {
  return (
    <div>
      <dt className="flex items-center gap-2 text-[0.62rem] font-black tracking-[0.14em] text-mint uppercase">
        <span aria-hidden="true" className="[&>svg]:size-3.5">
          {icon}
        </span>
        {label}
      </dt>
      <dd className="mt-2 font-headline text-xl font-black">{leaderLabel(leader)}</dd>
    </div>
  );
}

function CompareRow({
  label,
  note,
  leader,
  aValue,
  bValue,
  aAdvertised,
  bAdvertised,
  format,
  reduceMotion,
}: {
  label: string;
  note: string;
  leader: Leader;
  aValue: number;
  bValue: number;
  aAdvertised?: number;
  bAdvertised?: number;
  format: (value: number) => string;
  reduceMotion: boolean;
}) {
  const max = Math.max(Math.abs(aValue), Math.abs(bValue), 1);
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-headline text-[0.95rem] font-black tracking-[-0.01em]">{label}</h3>
        <p className="text-[0.62rem] font-black tracking-[0.12em] text-muted uppercase">{note}</p>
      </div>
      <div className="mt-3.5 grid gap-3.5">
        <CompareBar
          side="A"
          value={aValue}
          max={max}
          advertised={aAdvertised}
          leads={leader === "A"}
          format={format}
          reduceMotion={reduceMotion}
        />
        <CompareBar
          side="B"
          value={bValue}
          max={max}
          advertised={bAdvertised}
          leads={leader === "B"}
          format={format}
          reduceMotion={reduceMotion}
        />
      </div>
    </div>
  );
}

function CompareBar({
  side,
  value,
  max,
  advertised,
  leads,
  format,
  reduceMotion,
}: {
  side: "A" | "B";
  value: number;
  max: number;
  advertised?: number;
  leads: boolean;
  format: (value: number) => string;
  reduceMotion: boolean;
}) {
  const width = Math.max(0, Math.min(1, Math.abs(value) / max)) * 100;
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="flex items-center gap-2 text-[0.62rem] font-black tracking-[0.14em] uppercase">
          Job {side}
          {leads && (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[0.58rem] text-paper">
              <Check className="size-2.5" aria-hidden="true" strokeWidth={4} />
              Leads
            </span>
          )}
        </span>
        <span className="numeric flex items-baseline gap-2">
          {advertised !== undefined && (
            <span className="text-xs text-muted line-through">{formatPeso(advertised)}</span>
          )}
          <strong className="text-lg font-black">{format(value)}</strong>
        </span>
      </div>
      <div className="mt-1.5 h-3.5 overflow-hidden rounded-full bg-ink/8">
        <motion.div
          className={`h-full rounded-full ${leads ? "bg-ink" : "bg-accent/70"}`}
          initial={reduceMotion ? false : { width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{
            duration: reduceMotion ? 0 : 0.7,
            delay: reduceMotion ? 0 : side === "B" ? 0.1 : 0,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      </div>
      {value < 0 && (
        <p className="mt-1.5 text-[0.7rem] font-bold text-danger">
          Negative estimated cash after transport.
        </p>
      )}
    </div>
  );
}
