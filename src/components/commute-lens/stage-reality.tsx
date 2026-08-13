"use client";

import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  BadgePercent,
  Clock3,
  Gauge,
  Hourglass,
  Info,
  Plus,
  Printer,
  RotateCcw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { toExplainAnalysisRequest } from "@/shared/contracts/explanation";
import type { CommuteReadiness } from "@/application/assess-commute-readiness/use-case";
import type { ResearchedCommuteRoutePlan } from "@/application/research-commute-route/research-route";
import type { FareConfirmationSummary } from "@/application/fare-confirmation/fare-confirmation.service";
import { BreakEvenCard } from "./break-even-card";
import { CommuteDirectionsCard } from "./commute-directions-card";
import { CommuteReadinessCard } from "./commute-readiness-card";
import { CommuteViabilityPlanner } from "./commute-viability-planner";
import { ActionButton } from "@/components/ui/action-button";
import { Eyebrow } from "@/components/ui/typography";
import { describeFareDiscount, type FarePolicyImpact } from "@/domain/fare";
import type {
  CommuteAnalysis,
  CommuteRoute,
  DataSource,
  JobRealityAnalysis,
} from "@/domain/models";
import type { CommuteViabilityPlan } from "@/domain/job/commute-viability";
import type { JobScenario, JobScenarioDelta } from "@/domain/job/scenario";
import { AnimatedCurrency } from "./animated-currency";
import { ExplanationPanel } from "./explanation-panel";
import { FarePolicyCard } from "./fare-policy-card";
import {
  BURDEN_BANDS,
  burdenBand,
  formatHours,
  formatMinutes,
  formatNumber,
  formatPeso,
  formatPercent,
} from "./format";
import { describeRouteStatus, routeStatusMeaning } from "./provenance";
import { RealityReceipt } from "./reality-receipt";
import { RouteStatusBadge } from "./route-status-badge";
import { RouteResearchPanel } from "./route-research-panel";
import { ScenarioExplorer } from "./scenario-explorer";

/**
 * Stage four — the reveal.
 *
 * Hierarchy, top to bottom: cash after transport, what the commute costs in
 * money, what it costs in time, effective hourly value, then burden. Nothing on
 * this screen is calculated here; every figure arrives from the domain layer.
 */
export function RealityStage({
  analysis,
  scenario,
  commute,
  baselineDays,
  scenarioDays,
  scenarioDelta,
  farePolicyImpact,
  fareConfirmations,
  researchedRoutePlan,
  activeScenarioRoute,
  scenarioRouteState,
  readiness,
  readinessState,
  viabilityPlan,
  viabilityTargetIncome,
  onScenarioDaysChange,
  onViabilityTargetIncomeChange,
  onResearchedRoutePlanChange,
  reduceMotion,
  onEdit,
  onCompare,
  onPrint,
  onReset,
}: {
  analysis: JobRealityAnalysis;
  scenario: JobScenario;
  commute: CommuteAnalysis;
  baselineDays: number;
  scenarioDays: number;
  scenarioDelta: JobScenarioDelta;
  farePolicyImpact: FarePolicyImpact | null;
  fareConfirmations: readonly FareConfirmationSummary[];
  researchedRoutePlan: ResearchedCommuteRoutePlan | null;
  activeScenarioRoute: CommuteRoute | null;
  scenarioRouteState: "idle" | "loading" | "error";
  readiness: CommuteReadiness | null;
  readinessState: "idle" | "loading" | "unavailable";
  viabilityPlan: CommuteViabilityPlan | null;
  viabilityTargetIncome: number;
  onScenarioDaysChange: (days: number) => void;
  onViabilityTargetIncomeChange: (value: number) => void;
  onResearchedRoutePlanChange: (plan: ResearchedCommuteRoutePlan | null) => void;
  reduceMotion: boolean;
  onEdit: () => void;
  onCompare: () => void;
  onPrint: () => void;
  onReset: () => void;
}) {
  const activeRoute = activeScenarioRoute ?? analysis.commute.route;
  const status = describeRouteStatus(activeRoute);
  const scenarioDiffersFromBaseline =
    scenarioDays !== baselineDays || activeRoute?.id !== analysis.commute.route?.id;
  const hasCommute = scenario.monthlyFare > 0 || scenario.monthlyCommuteHours > 0;
  const fareDiscount = describeFareDiscount(analysis.fareDiscountClass);
  const fareEvidence = fareConfirmations.filter((item) => item.reportCount > 0);
  const confirmedFareLegs = fareEvidence.filter((item) => item.status === "community-submitted");

  /*
   * A unit conversion for readability, not a metric: the same commute hours,
   * expressed in the user's own paid-day length.
   */
  const commuteInWorkingDays = scenario.monthlyCommuteHours / analysis.jobOffer.workingHoursPerDay;

  return (
    <div className="pt-6 lg:pt-8">
      <header className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div className="min-w-0">
          <Eyebrow>Step four · your reality</Eyebrow>
          <h1 className="mt-2 font-headline text-[clamp(1.9rem,5vw,3.2rem)] leading-[0.95] font-black tracking-[-0.045em]">
            {analysis.jobOffer.title} at {analysis.jobOffer.company}
          </h1>
        </div>
        <ActionButton variant="secondary" onClick={onEdit}>
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to offer
        </ActionButton>
      </header>

      {/* ---------- 1. The headline number ---------- */}
      <motion.section
        initial={reduceMotion ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="ink-panel on-ink mt-5 overflow-hidden print:hidden"
      >
        <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="p-6 sm:p-9">
            <Eyebrow tone="mint">Estimated take-home after transport</Eyebrow>
            <AnimatedCurrency
              value={scenario.incomeAfterCommute}
              reduceMotion={reduceMotion}
              className="mt-3 block font-headline text-[clamp(3rem,11vw,6rem)] leading-[0.85] font-black tracking-[-0.06em]"
            />
            <ol className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
              <li className="numeric">
                <span className="text-paper/55">Advertised </span>
                <strong className="font-bold">{formatPeso(analysis.jobOffer.monthlySalary)}</strong>
              </li>
              <li aria-hidden="true" className="text-paper/30">
                →
              </li>
              <li className="numeric">
                <span className="text-paper/55">Take-home est. </span>
                <strong className="font-bold">{formatPeso(scenario.estimatedTakeHomePay)}</strong>
              </li>
              <li aria-hidden="true" className="text-paper/30">
                →
              </li>
              <li className="numeric">
                <span className="text-paper/55">Transport </span>
                <strong className="font-bold text-mint">−{formatPeso(scenario.monthlyFare)}</strong>
              </li>
            </ol>
            <p className="mt-6 max-w-md text-xs leading-relaxed text-paper/60">
              Take-home uses your own percentage estimate. Fares are estimated, not ticketed. This
              is a decision aid, not payroll.
            </p>
          </div>

          {/* The aha moment, stated in one sentence. */}
          <aside className="bg-mint p-6 text-ink sm:p-8">
            <Eyebrow>What the offer letter leaves out</Eyebrow>
            {hasCommute ? (
              <>
                <p className="mt-3 text-[1.15rem] leading-snug font-bold sm:text-[1.35rem]">
                  Getting to this job costs about{" "}
                  <span className="numeric text-flame">{formatPeso(scenario.monthlyFare)}</span> and{" "}
                  <span className="numeric text-flame">
                    {formatHours(scenario.monthlyCommuteHours)}
                  </span>{" "}
                  every month.
                </p>
                <p className="mt-3.5 text-sm leading-relaxed text-ink/75">
                  That is roughly{" "}
                  <strong className="numeric font-bold">
                    {commuteInWorkingDays.toFixed(1)} of your{" "}
                    {formatNumber(analysis.jobOffer.workingHoursPerDay)}-hour days
                  </strong>{" "}
                  spent travelling — unpaid, and invisible on the payslip.
                </p>
              </>
            ) : (
              <>
                <p className="mt-3 text-[1.15rem] leading-snug font-bold sm:text-[1.35rem]">
                  This schedule has no commute, so the whole estimated take-home stays with you.
                </p>
                <p className="mt-3.5 text-sm leading-relaxed text-ink/75">
                  Try adding office days below to see what a change of arrangement would cost.
                </p>
              </>
            )}
          </aside>
        </div>
      </motion.section>

      {/* ---------- 2, 3, 4. Cost, time, hourly value ---------- */}
      <div className="mt-5 grid gap-5 md:grid-cols-3 print:hidden">
        <MetricCard
          icon={<Wallet />}
          label="Monthly commute cost"
          value={formatPeso(scenario.monthlyFare)}
          detail={
            hasCommute
              ? `${formatNumber(commute.officeDaysPerMonth)} office days at ${formatPeso(commute.dailyFare)} round trip.${
                  fareDiscount.rate > 0 ? ` ${fareDiscount.shortLabel} applied.` : ""
                }`
              : "No office days, no fares."
          }
        />
        <MetricCard
          icon={<Clock3 />}
          label="Monthly commute time"
          value={formatHours(scenario.monthlyCommuteHours)}
          detail={
            hasCommute
              ? `${formatMinutes(commute.dailyMinutes)} on every office day.`
              : "No travel time to account for."
          }
        >
          <TimeBlocks days={commuteInWorkingDays} reduceMotion={reduceMotion} />
        </MetricCard>
        <MetricCard
          icon={<Hourglass />}
          label="Effective hourly value"
          labelNote="including commute time"
          value={`${formatPeso(scenario.effectiveHourlyValue)}/hr`}
          detail={`Cash after transport spread across ${formatHours(scenario.effectiveMonthlyHours)} of paid work plus travel.`}
        />
      </div>

      <div className="mt-5 print:hidden">
        <BreakEvenCard
          analysis={analysis}
          monthlyCommuteFare={scenario.monthlyFare}
          scenarioDays={scenarioDays}
        />
      </div>

      <div className="mt-5">
        <CommuteViabilityPlanner
          plan={viabilityPlan}
          targetIncomeAfterCommute={viabilityTargetIncome}
          onTargetIncomeAfterCommuteChange={onViabilityTargetIncomeChange}
        />
      </div>

      {/* ---------- 5. Burden, and where the money goes ---------- */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2 print:hidden">
        <BurdenScale value={scenario.commuteBurdenPercentage} reduceMotion={reduceMotion} />
        <MoneyFlow analysis={analysis} scenario={scenario} reduceMotion={reduceMotion} />
      </div>

      {/* ---------- Fare policy watch ---------- */}
      {farePolicyImpact && (
        <div className="mt-5">
          <FarePolicyCard impact={farePolicyImpact} reduceMotion={reduceMotion} />
        </div>
      )}

      {/* ---------- Scenario exploration ---------- */}
      <div className="mt-5">
        <ScenarioExplorer
          baselineDays={baselineDays}
          scenario={scenario}
          delta={scenarioDelta}
          scenarioDays={scenarioDays}
          onChange={onScenarioDaysChange}
          routeState={scenarioRouteState}
          reduceMotion={reduceMotion}
        />
      </div>

      {/* ---------- Practical route guidance ---------- */}
      <div className="mt-5">
        <CommuteDirectionsCard route={activeRoute} />
      </div>

      <div className="mt-5">
        <RouteResearchPanel
          route={activeRoute}
          plan={researchedRoutePlan}
          onPlanChange={onResearchedRoutePlanChange}
        />
      </div>

      {/* ---------- Readiness is transient and never changes financial analysis ---------- */}
      <div className="mt-5">
        <CommuteReadinessCard readiness={readiness} state={readinessState} />
      </div>

      {scenarioDiffersFromBaseline ? (
        <section className="app-panel mt-5 p-5 sm:p-6 print:hidden">
          <Eyebrow>Baseline explanation</Eyebrow>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            You are viewing a different office-day scenario. Return to {baselineDays} office day
            {baselineDays === 1 ? "" : "s"} a week for an AI explanation of the original offer; the
            figures above already reflect the scenario you selected.
          </p>
        </section>
      ) : (
        <ExplanationPanel
          className="mt-5"
          prompt="Get a short, plain-language read on what this result means for you."
          payload={toExplainAnalysisRequest(analysis)}
        />
      )}

      {/* ---------- The receipt, and where the numbers came from ---------- */}
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] print:block">
        <RealityReceipt
          analysis={analysis}
          scenario={scenario}
          fareConfirmations={fareConfirmations}
          route={activeRoute}
          reduceMotion={reduceMotion}
        />

        <div className="grid content-start gap-5 print:hidden">
          <section className="app-panel p-5 sm:p-6">
            <Eyebrow>Where these numbers come from</Eyebrow>
            <div className="mt-3 flex flex-wrap items-start gap-3">
              <RouteStatusBadge status={status} />
              <p className="min-w-0 flex-1 text-[0.78rem] leading-relaxed text-muted">
                {routeStatusMeaning(status.kind)}
              </p>
            </div>
            {fareDiscount.rate > 0 && (
              <p className="mt-3.5 flex items-start gap-2 rounded-[0.9rem] bg-leaf/8 p-3 text-[0.75rem] leading-relaxed">
                <BadgePercent className="mt-0.5 size-3.5 shrink-0 text-leaf" aria-hidden="true" />
                <span>
                  <strong className="font-bold">{fareDiscount.shortLabel} applied.</strong>{" "}
                  {fareDiscount.note}
                </span>
              </p>
            )}
            {fareEvidence.length > 0 && (
              <p className="mt-3.5 flex items-start gap-2 rounded-[0.9rem] bg-mint/55 p-3 text-[0.75rem] leading-relaxed">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-leaf" aria-hidden="true" />
                <span>
                  <strong className="font-bold">
                    {confirmedFareLegs.length > 0
                      ? `${confirmedFareLegs.length} leg${confirmedFareLegs.length === 1 ? " has" : "s have"} community fare submissions.`
                      : "Community fare submissions are still being collected."}
                  </strong>{" "}
                  These session-only aggregates are not independently verified; the transport total
                  above remains the original route estimate.
                </span>
              </p>
            )}
            {activeRoute && activeRoute.sources.length > 0 && (
              <ul className="mt-4 space-y-2.5 border-t border-ink/10 pt-4">
                {activeRoute.sources.map((source) => (
                  <SourceRow key={`${source.type}-${source.name}`} source={source} />
                ))}
              </ul>
            )}
            <p className="mt-4 flex items-start gap-2 border-t border-ink/10 pt-4 text-[0.72rem] leading-relaxed text-muted">
              <Info className="mt-0.5 size-3.5 shrink-0 text-flame" aria-hidden="true" />
              <span>
                Fares and travel times are estimates, and take-home uses the percentage you set.
                Nothing here is an official tax, payroll, or financial figure.
              </span>
            </p>
          </section>

          <div className="flex flex-wrap gap-3">
            <ActionButton variant="secondary" onClick={onPrint}>
              <Printer className="size-3.5" aria-hidden="true" />
              Print receipt
            </ActionButton>
            <ActionButton variant="secondary" onClick={onReset}>
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Start a new analysis
            </ActionButton>
          </div>
        </div>
      </div>

      {/* ---------- Onward to comparison ---------- */}
      <section className="ink-panel on-ink mt-5 flex flex-col items-center px-6 py-10 text-center print:hidden">
        <Eyebrow tone="mint">Would another offer actually pay more?</Eyebrow>
        <h2 className="mt-3 max-w-xl font-headline text-2xl leading-tight font-black tracking-[-0.03em] sm:text-3xl">
          Put a second job beside this one and compare the life behind the salary.
        </h2>
        <ActionButton variant="accent" className="mt-6" onClick={onCompare}>
          <Plus className="size-4" aria-hidden="true" />
          Compare another job
          <ArrowRight className="size-4" aria-hidden="true" />
        </ActionButton>
      </section>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  labelNote,
  value,
  detail,
  children,
}: {
  icon: ReactNode;
  label: string;
  labelNote?: string;
  value: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <section className="app-panel flex flex-col p-5 sm:p-6">
      <h3 className="flex items-start gap-2 text-[0.62rem] font-black tracking-[0.14em] text-muted uppercase">
        <span aria-hidden="true" className="text-flame [&>svg]:size-3.5">
          {icon}
        </span>
        <span>
          {label}
          {labelNote && (
            <span className="mt-0.5 block tracking-[0.08em] text-muted/80 normal-case">
              {labelNote}
            </span>
          )}
        </span>
      </h3>
      <p className="numeric mt-3 font-headline text-[clamp(1.8rem,4.5vw,2.4rem)] leading-none font-black tracking-[-0.04em]">
        {value}
      </p>
      <p className="mt-2.5 text-[0.78rem] leading-relaxed text-muted">{detail}</p>
      {children}
    </section>
  );
}

/** Each block is one of the user's own working days spent travelling. */
function TimeBlocks({ days, reduceMotion }: { days: number; reduceMotion: boolean }) {
  const blocks = [0, 1, 2, 3, 4, 5];
  return (
    <div className="mt-auto pt-5">
      <div className="grid grid-cols-6 gap-1.5" aria-hidden="true">
        {blocks.map((index) => (
          <motion.span
            key={index}
            initial={reduceMotion ? false : { scaleY: 0.06 }}
            animate={{ scaleY: Math.max(0.06, Math.min(1, days - index)) }}
            transition={{
              duration: reduceMotion ? 0 : 0.35,
              delay: reduceMotion ? 0 : index * 0.05,
              ease: [0.22, 1, 0.36, 1],
            }}
            className="h-9 origin-bottom rounded-[3px] bg-mint ring-1 ring-ink/10"
          />
        ))}
      </div>
      <p className="mt-2 text-[0.65rem] text-muted">Each block is one of your working days.</p>
    </div>
  );
}

/**
 * Burden as a labelled scale rather than a dial. The band name is printed, the
 * marker is positioned, and the number is stated — three independent cues.
 */
function BurdenScale({ value, reduceMotion }: { value: number; reduceMotion: boolean }) {
  const band = burdenBand(value);
  // The 20% ceiling matches the scale the app has always drawn (value × 5).
  const position = Math.min(100, Math.max(0, value * 5));
  const tints = ["bg-leaf/25", "bg-mint", "bg-sand/55", "bg-accent/25"];

  return (
    <section className="app-panel p-5 sm:p-6">
      <h3 className="flex items-center gap-2 text-[0.62rem] font-black tracking-[0.14em] text-muted uppercase">
        <Gauge className="size-3.5 text-flame" aria-hidden="true" />
        Commute burden
      </h3>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="numeric font-headline text-[clamp(1.8rem,4.5vw,2.4rem)] leading-none font-black tracking-[-0.04em]">
          {formatPercent(value)}
        </p>
        <p className="text-sm font-black tracking-[0.1em] text-flame uppercase">{band.label}</p>
      </div>
      <p className="mt-2 text-[0.78rem] leading-relaxed text-muted">
        Share of your estimated take-home spent on getting to work.
      </p>

      <div className="mt-5">
        <div className="relative h-2.5 overflow-hidden rounded-full" aria-hidden="true">
          <div className="grid h-full grid-cols-[15fr_20fr_25fr_40fr]">
            {tints.map((tint, index) => (
              <span key={index} className={tint} />
            ))}
          </div>
        </div>
        <div className="relative mt-1 h-3" aria-hidden="true">
          <motion.span
            className="absolute top-0 -ml-[5px] block size-2.5 rotate-45 rounded-[2px] bg-ink"
            initial={reduceMotion ? false : { left: "0%" }}
            animate={{ left: `${position}%` }}
            transition={{ duration: reduceMotion ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <ol className="mt-1.5 grid grid-cols-[15fr_20fr_25fr_40fr] text-[0.58rem] font-black tracking-[0.06em] uppercase">
          {BURDEN_BANDS.map((scaleBand, index) => (
            <li
              key={scaleBand.label}
              className={index === band.index ? "text-ink" : "text-muted/55"}
            >
              {scaleBand.label}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * One stacked bar for the whole gross salary. The deductions segment is the
 * leftover width, so no figure is derived here — its size is layout, and its
 * label states the assumption instead of restating a peso amount.
 */
function MoneyFlow({
  analysis,
  scenario,
  reduceMotion,
}: {
  analysis: JobRealityAnalysis;
  scenario: JobScenario;
  reduceMotion: boolean;
}) {
  const gross = analysis.jobOffer.monthlySalary;
  const takeHomePercent = Math.round((analysis.jobOffer.estimatedTakeHomeRate ?? 0.9) * 100);
  const share = (value: number) => (gross > 0 ? Math.max(0, Math.min(1, value / gross)) * 100 : 0);

  const legend = [
    {
      swatch: "bg-ink",
      label: "Stays with you after transport",
      value: formatPeso(scenario.incomeAfterCommute),
    },
    { swatch: "bg-sand", label: "Transport", value: formatPeso(scenario.monthlyFare) },
    {
      swatch: "bg-accent",
      label: "Deductions estimate",
      value: `${100 - takeHomePercent}% assumption`,
    },
  ];

  return (
    <section className="app-panel p-5 sm:p-6">
      <h3 className="text-[0.62rem] font-black tracking-[0.14em] text-muted uppercase">
        Where the {formatPeso(gross)} goes
      </h3>

      <div
        className="mt-4 flex h-11 overflow-hidden rounded-[0.6rem] bg-accent"
        role="img"
        aria-label={`Of ${formatPeso(gross)} gross, ${formatPeso(scenario.incomeAfterCommute)} stays with you after ${formatPeso(scenario.monthlyFare)} of transport, assuming ${takeHomePercent}% take-home.`}
      >
        <motion.span
          className="block bg-ink"
          initial={reduceMotion ? false : { width: 0 }}
          animate={{ width: `${share(scenario.incomeAfterCommute)}%` }}
          transition={{ duration: reduceMotion ? 0 : 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.span
          className="block bg-sand"
          initial={reduceMotion ? false : { width: 0 }}
          animate={{ width: `${share(scenario.monthlyFare)}%` }}
          transition={{ duration: reduceMotion ? 0 : 0.7, delay: reduceMotion ? 0 : 0.1 }}
        />
      </div>

      <ul className="mt-4 space-y-2.5">
        {legend.map((item) => (
          <li key={item.label} className="flex items-center gap-2.5 text-[0.78rem]">
            <span className={`size-2.5 shrink-0 rounded-sm ${item.swatch}`} aria-hidden="true" />
            <span className="min-w-0 flex-1 text-muted">{item.label}</span>
            <span className="numeric shrink-0 font-bold">{item.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SourceRow({ source }: { source: DataSource }) {
  return (
    <li className="flex items-start gap-2.5">
      <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-leaf" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-[0.78rem] font-bold break-words">{source.name}</span>
        <span className="mt-0.5 block text-[0.68rem] text-muted">
          {source.type} · {source.confidence ?? "unspecified"} confidence
          {source.effectiveDate ? ` · as of ${source.effectiveDate}` : ""}
        </span>
      </span>
    </li>
  );
}
