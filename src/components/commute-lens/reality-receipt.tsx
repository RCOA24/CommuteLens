"use client";

import { motion } from "motion/react";
import { ChevronDown, CircleAlert } from "lucide-react";
import {
  FARE_MATRIX_CHECKED_ON,
  ROAD_DISTANCE_FACTOR,
  describeFareDiscount,
  type FareDiscountDescriptor,
} from "@/domain/fare";
import type { FareConfirmationSummary } from "@/application/fare-confirmation/fare-confirmation.service";
import type { CommuteRoute, JobRealityAnalysis } from "@/domain/models";
import type { JobScenario } from "@/domain/job/scenario";
import { AnimatedCurrency } from "./animated-currency";
import { formatHours, formatPeso, formatPercent, scheduleLabel } from "./format";
import { describeRouteStatus } from "./provenance";

/**
 * The printable artefact.
 *
 * Everything here is display: each figure arrives already calculated. The
 * calculation notes appear twice on purpose — inside a <details> for the screen,
 * and as a print-only block, because a closed <details> does not print and a
 * receipt without its assumptions is not honest.
 */
export function RealityReceipt({
  analysis,
  scenario,
  fareConfirmations = [],
  route,
  reduceMotion,
}: {
  analysis: JobRealityAnalysis;
  scenario: JobScenario;
  fareConfirmations?: readonly FareConfirmationSummary[];
  route?: CommuteRoute | null;
  reduceMotion: boolean;
}) {
  const status = describeRouteStatus(route ?? analysis.commute.route);
  const takeHomePercent = Math.round((analysis.jobOffer.estimatedTakeHomeRate ?? 0.9) * 100);
  const fareDiscount = describeFareDiscount(analysis.fareDiscountClass);
  const confirmedFareLegs = fareConfirmations.filter(
    (item) => item.status === "community-submitted",
  );

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="reality-receipt"
      aria-label="Job reality receipt"
    >
      <div className="receipt-edge receipt-edge-top" aria-hidden="true" />
      <div className="px-6 py-5 sm:px-7">
        <div className="text-center">
          <p className="text-[0.65rem] font-black tracking-[0.2em] text-flame">COMMUTE LENS</p>
          <p className="mt-1 text-[0.7rem] font-black tracking-[0.16em]">JOB REALITY RECEIPT</p>
        </div>

        <div className="receipt-rule" aria-hidden="true" />

        <p className="text-[0.68rem] tracking-[0.06em] text-muted uppercase">
          {analysis.jobOffer.company}
        </p>
        <h2 className="mt-1 font-headline text-xl leading-tight font-black break-words">
          {analysis.jobOffer.title}
        </h2>
        <p className="mt-2 text-[0.72rem] leading-relaxed text-muted break-words">
          {analysis.jobOffer.officeLocation.label}
        </p>
        <p className="mt-1 text-[0.72rem] font-bold">{scheduleLabel(scenario.days)}</p>

        <div className="receipt-rule" aria-hidden="true" />

        <div className="space-y-2.5">
          <div className="receipt-row font-bold">
            <span>Gross salary</span>
            <span>{formatPeso(analysis.jobOffer.monthlySalary)}</span>
          </div>
          <div className="receipt-row text-muted">
            <span>Estimated take-home ({takeHomePercent}%)</span>
            <span>{formatPeso(scenario.estimatedTakeHomePay)}</span>
          </div>
          <div className="receipt-row text-muted">
            <span>Monthly transport</span>
            <span>−{formatPeso(scenario.monthlyFare)}</span>
          </div>
          <div className="receipt-row text-muted">
            <span>Fare class</span>
            <span>{fareDiscount.shortLabel}</span>
          </div>
          {confirmedFareLegs.length > 0 && (
            <div className="receipt-row text-muted">
              <span>Community fare submissions</span>
              <span>
                {confirmedFareLegs.length} confirmed leg{confirmedFareLegs.length === 1 ? "" : "s"}
              </span>
            </div>
          )}
        </div>

        <div className="receipt-rule" aria-hidden="true" />

        <p className="text-[0.62rem] font-black tracking-[0.12em] text-muted uppercase">
          Estimated take-home after transport
        </p>
        <AnimatedCurrency
          value={scenario.incomeAfterCommute}
          reduceMotion={reduceMotion}
          className="mt-1 block font-headline text-[clamp(2.4rem,8vw,3.4rem)] leading-none font-black tracking-[-0.05em] text-accent"
        />

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-dashed border-ink/25 pt-4">
          <div>
            <span className="receipt-mini-label">Effective hourly</span>
            <strong className="numeric block text-base">
              {formatPeso(scenario.effectiveHourlyValue)}/hr
            </strong>
            <span className="mt-0.5 block text-[0.58rem] leading-tight text-muted">
              includes commute time
            </span>
          </div>
          <div>
            <span className="receipt-mini-label">Commute burden</span>
            <strong className="numeric block text-base">
              {formatPercent(scenario.commuteBurdenPercentage)}
            </strong>
            <span className="mt-0.5 block text-[0.58rem] leading-tight text-muted">
              of estimated take-home
            </span>
          </div>
        </div>

        {scenario.incomeAfterCommute < 0 && (
          <p
            role="alert"
            className="mt-4 flex items-start gap-2 rounded-lg bg-danger/10 p-3 text-[0.7rem] leading-relaxed font-bold text-danger"
          >
            <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Estimated transport exceeds estimated take-home. Check the route, the fare, and your
              take-home assumption before trusting this figure.
            </span>
          </p>
        )}

        <details className="mt-5 border-t border-dashed border-ink/25 pt-3 print:hidden">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-[0.72rem] font-bold">
            How we calculated this
            <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
          </summary>
          <CalculationNotes
            takeHomePercent={takeHomePercent}
            statusLabel={status.label}
            disclosure={status.disclosure}
            sourceNames={status.sourceNames}
            fareDiscount={fareDiscount}
            confirmedFareLegs={confirmedFareLegs}
            analysis={analysis}
          />
        </details>

        {/* Closed <details> elements do not print, so paper gets its own copy. */}
        <div className="mt-4 hidden border-t border-dashed border-ink/25 pt-3 print:block">
          <p className="text-[0.6rem] font-bold uppercase">How we calculated this</p>
          <CalculationNotes
            takeHomePercent={takeHomePercent}
            statusLabel={status.label}
            disclosure={status.disclosure}
            sourceNames={status.sourceNames}
            fareDiscount={fareDiscount}
            confirmedFareLegs={confirmedFareLegs}
            analysis={analysis}
          />
        </div>

        <p className="mt-5 border-t border-dashed border-ink/25 pt-3 text-center text-[0.66rem] leading-relaxed">
          Salary is the headline.
          <br />
          <span className="font-bold">Commute reality tells the full story.</span>
        </p>
      </div>
      <div className="receipt-edge receipt-edge-bottom" aria-hidden="true" />
    </motion.section>
  );
}

function CalculationNotes({
  takeHomePercent,
  statusLabel,
  disclosure,
  sourceNames,
  fareDiscount,
  confirmedFareLegs,
  analysis,
}: {
  takeHomePercent: number;
  statusLabel: string;
  disclosure: string;
  sourceNames: string[];
  fareDiscount: FareDiscountDescriptor;
  confirmedFareLegs: readonly FareConfirmationSummary[];
  analysis: JobRealityAnalysis;
}) {
  return (
    <div className="mt-2 space-y-2 text-[0.66rem] leading-relaxed text-muted">
      <p>
        Take-home is your own estimate of {takeHomePercent}% of gross salary. It is not a payroll or
        tax calculation.
      </p>
      <p>
        Fares are priced per leg from an estimated road distance ({ROAD_DISTANCE_FACTOR}x
        straight-line), using the LTFRB jeepney matrix where it applies and Commute Lens estimated
        bands elsewhere. Rates checked {FARE_MATRIX_CHECKED_ON}.
      </p>
      {fareDiscount.rate > 0 && (
        <p>
          <strong>{fareDiscount.shortLabel}</strong> applied at{" "}
          {Math.round(fareDiscount.rate * 100)}% off, per {fareDiscount.legalBasis}.
        </p>
      )}
      {confirmedFareLegs.length > 0 && (
        <p>
          {confirmedFareLegs.length} route leg{confirmedFareLegs.length === 1 ? " has" : "s have"}{" "}
          community fare submissions. They are session-only aggregates, not independently verified,
          and do not replace the estimated transport total on this receipt.
        </p>
      )}
      <p>
        Monthly transport = one-way estimated fare × 2 × office days a week × 52 ÷ 12. Commute time
        is never deducted from cash; it is included only in effective hourly value, which spreads
        pay across {formatHours(analysis.monthlyWorkHours)} of paid work plus your commute hours.
      </p>
      <p>
        Route: <strong>{statusLabel}</strong>. {disclosure}
      </p>
      {sourceNames.length > 0 && <p>Sources: {sourceNames.join("; ")}.</p>}
      <p>Not payroll, tax, or financial advice.</p>
    </div>
  );
}
