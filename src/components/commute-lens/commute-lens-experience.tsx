"use client";

import { AnimatePresence, motion } from "motion/react";
import { Navigation } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { CommuteReadinessResult } from "@/app/api/commute/readiness/route";
import type { FareConfirmationResult } from "@/app/api/fare-confirmations/route";
import type { CommuteReadiness } from "@/application/assess-commute-readiness/use-case";
import type { ResearchedCommuteRoutePlan } from "@/application/research-commute-route/research-route";
import type { FareConfirmationSummary } from "@/application/fare-confirmation/fare-confirmation.service";
import type { AnalyzeJobOfferResult } from "@/application/analyze-job-offer/use-case";
import type { RoutePreviewResult } from "@/app/api/commute/route/route";
import { PRIMARY_DEMO_SCENARIO } from "@/data/demo";
import { calculateCommute } from "@/domain/commute/calculations";
import { estimateSuspendedFareHikeImpact, type FareDiscountClass } from "@/domain/fare";
import { DEFAULT_PAYROLL_DEDUCTIONS } from "@/domain/finance/philippine-payroll";
import { calculateCommuteViabilityPlan } from "@/domain/job/commute-viability";
import { calculateJobScenario, diffJobScenarios } from "@/domain/job/scenario";
import {
  DEFAULT_HYBRID_SCHEDULE,
  WEEKDAYS,
  countOnsiteDays,
  countWorkingDays,
  deriveWorkArrangement,
  scheduleForArrangement,
  scheduleFromLegacy,
  type WeeklyWorkSchedule,
} from "@/domain/work-schedule";
import type { CommuteRoute, JobRealityAnalysis, Location, WorkArrangement } from "@/domain/models";
import type { OfferDocumentExtraction } from "@/application/extract-offer-document/offer-extraction";
import type { CommuterProfile } from "@/application/commuter-profile/memory";
import { EASE_EXIT, SPRING_CINEMATIC, SPRING_SMOOTH, materialize } from "@/lib/motion";
import { useMotionPreference } from "@/hooks/use-motion-preference";
import { useCommuterProfile, type CommuterProfileInput } from "@/hooks/use-commuter-profile";
import { CommuterMemoryPanel, RememberedSetupBanner } from "./commuter-memory";
import { ExtractionNotice } from "./extraction-notice";
import { JourneyOutro } from "./journey-outro";
import { JourneyWrapUp } from "./journey-wrap-up";
import { MotionToggle } from "./motion-toggle";
import { OfferDocumentUpload } from "./offer-document-upload";
import { formatPeso } from "./format";
import { IntroPrelude } from "./intro-prelude";
import { JourneyProgress } from "./journey-progress";
import type { OfferDraft } from "./offer-validation";
import { CalculatingStage } from "./stage-calculating";
import { CommuteSetupStage } from "./stage-commute";
import { ComparisonStage } from "./stage-compare";
import { OfferDetailsStage } from "./stage-offer";
import { RoutePreviewStage } from "./stage-route";
import { RealityStage } from "./stage-reality";

type Step = "commute" | "route" | "offer" | "calculating" | "reality" | "compare" | "outro";

/**
 * Turns an extracted arrangement and day count into a weekly schedule.
 *
 * The schedule is the calculation's only source of truth for onsite days, so an
 * extracted count has to be expressed as one. A stated working-day total is
 * honoured by promoting or demoting non-onsite days; onsite days are never moved,
 * because those came from the document.
 */
function scheduleFromExtraction(
  arrangement: WorkArrangement,
  onsiteDaysPerWeek: number | null,
  workingDaysPerWeek: number | null,
  fallback: WeeklyWorkSchedule,
): WeeklyWorkSchedule {
  const onsiteDays = onsiteDaysPerWeek ?? countOnsiteDays(fallback);
  const schedule = scheduleFromLegacy(arrangement, onsiteDays);
  if (workingDaysPerWeek === null) return schedule;

  for (const day of WEEKDAYS) {
    if (countWorkingDays(schedule) >= workingDaysPerWeek) break;
    if (schedule[day] === "off") schedule[day] = "wfh";
  }
  for (const day of [...WEEKDAYS].reverse()) {
    if (countWorkingDays(schedule) <= workingDaysPerWeek) break;
    if (schedule[day] === "wfh") schedule[day] = "off";
  }
  return schedule;
}

const PROGRESS_INDEX: Record<Step, number> = {
  commute: 0,
  route: 0,
  offer: 1,
  calculating: 1,
  reality: 2,
  compare: 3,
  outro: 3,
};

const seed = PRIMARY_DEMO_SCENARIO;

/**
 * The state machine for the whole journey.
 *
 * This component owns navigation, network calls, and the values the user has
 * entered. It renders no layout of its own beyond the shell: each stage is its
 * own presentational component, which is what keeps this file readable.
 *
 * Deliberate constraints preserved from the original implementation:
 *  - Remote arrangements skip route discovery entirely.
 *  - The route preview is sent to /analyze so preview and result cannot diverge.
 *  - Scenario changes recalculate client-side from retained route facts, so the
 *    slider is instant and never re-queries the transit provider unless a
 *    remote-to-onsite scenario genuinely needs a route.
 */
export function CommuteLensExperience() {
  /*
   * One subscription drives every animation in the tree. It reads the OS setting
   * but lets an explicit in-app choice override it, so someone whose system asks
   * for reduced motion can still opt into the journey's animation.
   */
  const { reduceMotion, systemPrefersReduced, setPreference } = useMotionPreference();
  const formId = useId();
  const routeRequestVersion = useRef(0);
  const readinessRequestVersion = useRef(0);
  const calculationRequestVersion = useRef(0);

  const [step, setStep] = useState<Step>("commute");
  const [isIntroVisible, setIsIntroVisible] = useState(true);
  const [origin, setOrigin] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [route, setRoute] = useState<CommuteRoute | null>(null);
  const [routeCandidates, setRouteCandidates] = useState<readonly CommuteRoute[]>([]);
  const [researchedRoutePlan, setResearchedRoutePlan] = useState<ResearchedCommuteRoutePlan | null>(
    null,
  );
  const [isDiscoveringRoute, setIsDiscoveringRoute] = useState(false);
  const [commuteError, setCommuteError] = useState<string | null>(null);

  const [draft, setDraft] = useState<OfferDraft>({
    title: seed.jobOffer.title,
    company: seed.jobOffer.company,
    salary: String(seed.jobOffer.monthlySalary),
    workingHours: "8",
    takeHomePercent: "90",
    payrollDeductions: { ...DEFAULT_PAYROLL_DEDUCTIONS },
    weeklySchedule: { ...DEFAULT_HYBRID_SCHEDULE },
  });
  const [arrangement, setArrangement] = useState<WorkArrangement>("hybrid");
  const [fareClass, setFareClass] = useState<FareDiscountClass>("regular");
  const [fareConfirmations, setFareConfirmations] = useState<readonly FareConfirmationSummary[]>(
    [],
  );
  const [offerError, setOfferError] = useState<string | null>(null);
  const [isCalculationReady, setIsCalculationReady] = useState(false);

  const [analysis, setAnalysis] = useState<JobRealityAnalysis | null>(null);
  const [baselineDays, setBaselineDays] = useState(3);
  const [scenarioDays, setScenarioDays] = useState(3);
  const [scenarioRouteState, setScenarioRouteState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [readiness, setReadiness] = useState<CommuteReadiness | null>(null);
  const [readinessState, setReadinessState] = useState<"idle" | "loading" | "unavailable">("idle");
  const [viabilityTargetIncome, setViabilityTargetIncome] = useState(0);

  /*
   * Backboard-backed additions.
   *
   * `appliedExtraction` keeps the pre-fill snapshot alongside the result so the
   * user can undo a document read in one click. Memory lives in its own hook and
   * stores nothing until the user asks for it.
   */
  const [appliedExtraction, setAppliedExtraction] = useState<{
    extraction: OfferDocumentExtraction;
    officeCandidates: readonly Location[];
    previousDraft: OfferDraft;
    previousArrangement: WorkArrangement;
  } | null>(null);
  const [isRememberedSetupDismissed, setIsRememberedSetupDismissed] = useState(false);
  /** Lets the closing screen reflect what the user actually did. */
  const [hasCompared, setHasCompared] = useState(false);
  const memory = useCommuterProfile();

  useLayoutEffect(() => {
    if (isIntroVisible) return;
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [isIntroVisible, step]);

  function invalidateRoute() {
    routeRequestVersion.current += 1;
    readinessRequestVersion.current += 1;
    setRoute(null);
    setRouteCandidates([]);
    setResearchedRoutePlan(null);
    setFareConfirmations([]);
    setReadiness(null);
    setReadinessState("idle");
    setIsDiscoveringRoute(false);
  }

  function selectOrigin(next: Location | null) {
    setOrigin(next);
    invalidateRoute();
  }

  function selectDestination(next: Location | null) {
    setDestination(next);
    invalidateRoute();
  }

  function selectArrangement(next: WorkArrangement) {
    setArrangement(next);
    setDraft((current) => ({ ...current, weeklySchedule: scheduleForArrangement(next) }));
    invalidateRoute();
  }

  function selectFareClass(next: FareDiscountClass) {
    setFareClass(next);
    // A route's fare entitlement is baked into its leg prices, so it must be
    // rediscovered instead of being relabelled under a new entitlement.
    invalidateRoute();
  }

  async function loadFareConfirmations(
    nextRoute: CommuteRoute,
    nextFareClass: FareDiscountClass,
    expectedRouteVersion: number,
  ) {
    try {
      const response = await fetch("/api/fare-confirmations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "lookup", route: nextRoute, discountClass: nextFareClass }),
      });
      const result = (await response.json()) as FareConfirmationResult;
      if (expectedRouteVersion !== routeRequestVersion.current) return;
      setFareConfirmations(result.success ? result.data.confirmations : []);
    } catch {
      // Confirmation is optional evidence; a lookup failure must not block routing.
      if (expectedRouteVersion === routeRequestVersion.current) setFareConfirmations([]);
    }
  }

  async function confirmRouteFare(
    segmentIndex: number,
    observedFare: number,
  ): Promise<string | null> {
    if (!route) return "Search for a route before confirming a fare.";
    try {
      const response = await fetch("/api/fare-confirmations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "confirm",
          route,
          discountClass: fareClass,
          segmentIndex,
          observedFare,
        }),
      });
      const result = (await response.json()) as FareConfirmationResult;
      if (!result.success) return result.error.message;
      setFareConfirmations(result.data.confirmations);
      return null;
    } catch {
      return "Could not send your confirmation. Check your connection and try again.";
    }
  }

  async function loadCommuteReadiness(nextRoute: CommuteRoute | null) {
    const requestVersion = ++readinessRequestVersion.current;
    setReadiness(null);
    setReadinessState("loading");
    try {
      const response = await fetch("/api/commute/readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route: nextRoute }),
      });
      const result = (await response.json()) as CommuteReadinessResult;
      if (requestVersion !== readinessRequestVersion.current) return;
      if (!result.success) {
        setReadinessState("unavailable");
        return;
      }
      setReadiness(result.data);
      setReadinessState("idle");
    } catch {
      if (requestVersion === readinessRequestVersion.current) setReadinessState("unavailable");
    }
  }

  async function discoverRoute() {
    if (!origin || !destination) {
      setCommuteError("Choose an origin and destination from the location search results.");
      return;
    }
    if (arrangement === "remote") {
      setRoute(null);
      setRouteCandidates([]);
      setFareConfirmations([]);
      setCommuteError(null);
      setStep("offer");
      return;
    }
    const requestVersion = ++routeRequestVersion.current;
    const requestedFareClass = fareClass;
    setCommuteError(null);
    setResearchedRoutePlan(null);
    setIsDiscoveringRoute(true);
    try {
      const response = await fetch("/api/commute/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination, discountClass: requestedFareClass }),
      });
      const result = (await response.json()) as RoutePreviewResult;
      if (requestVersion !== routeRequestVersion.current) return;
      if (!result.success) {
        setRoute(null);
        setFareConfirmations([]);
        setCommuteError(result.error.message);
        return;
      }
      const previewRoutes = result.data.routes;
      const initialRoute = previewRoutes[0];
      if (!initialRoute) {
        setRoute(null);
        setRouteCandidates([]);
        setFareConfirmations([]);
        setCommuteError("The transit provider returned no usable route.");
        return;
      }
      setRouteCandidates(previewRoutes);
      setRoute(initialRoute);
      void loadFareConfirmations(initialRoute, requestedFareClass, requestVersion);
      setStep("route");
    } catch {
      if (requestVersion === routeRequestVersion.current) {
        setCommuteError("Could not discover this route. Check your connection and try again.");
      }
    } finally {
      if (requestVersion === routeRequestVersion.current) setIsDiscoveringRoute(false);
    }
  }

  function selectPreviewRoute(nextRoute: CommuteRoute) {
    setRoute(nextRoute);
    setResearchedRoutePlan(null);
    setFareConfirmations([]);
    void loadFareConfirmations(nextRoute, fareClass, routeRequestVersion.current);
  }

  /**
   * The analyze request body. Shared with the memory layer so a remembered offer
   * is recalculated from exactly the inputs that produced the receipt.
   */
  function buildAnalyzePayload(nextOrigin: Location, nextDestination: Location) {
    const weeklySchedule = draft.weeklySchedule ?? scheduleForArrangement(arrangement);
    return {
      origin: nextOrigin,
      route,
      discountClass: fareClass,
      jobOffer: {
        id: `job-${crypto.randomUUID()}`,
        title: draft.title.trim(),
        company: draft.company.trim(),
        monthlySalary: Number(draft.salary),
        officeLocation: nextDestination,
        workArrangement: deriveWorkArrangement(weeklySchedule),
        onsiteDaysPerWeek: countOnsiteDays(weeklySchedule),
        workingDaysPerWeek: countWorkingDays(weeklySchedule),
        weeklySchedule,
        workingHoursPerDay: Number(draft.workingHours),
        payrollDeductions: draft.payrollDeductions ?? { ...DEFAULT_PAYROLL_DEDUCTIONS },
      },
    };
  }

  async function calculate() {
    if (!origin || !destination) {
      setOfferError("Choose an origin and destination before calculating.");
      return;
    }
    setOfferError(null);
    setIsCalculationReady(false);
    const requestVersion = ++calculationRequestVersion.current;
    setStep("calculating");

    const payload = buildAnalyzePayload(origin, destination);
    const calculatedOnsiteDays = payload.jobOffer.onsiteDaysPerWeek;

    try {
      /*
       * The floor on the wait is theatre with a purpose: the calculating screen
       * names the three facts the result is built from. Reduced-motion users get
       * a token delay instead of the full beat.
       */
      const [response] = await Promise.all([
        fetch("/api/commute/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }),
        new Promise((resolve) => setTimeout(resolve, reduceMotion ? 120 : 2100)),
      ]);
      const result = (await response.json()) as AnalyzeJobOfferResult;
      if (requestVersion !== calculationRequestVersion.current) return;
      if (!result.success) {
        setOfferError(result.error.message);
        setStep("offer");
        return;
      }
      setAnalysis(result.data);
      setRoute(result.data.commute.route);
      setBaselineDays(calculatedOnsiteDays);
      setScenarioDays(calculatedOnsiteDays);
      setViabilityTargetIncome(Math.max(0, result.data.incomeAfterCommute));
      setScenarioRouteState("idle");
      void loadCommuteReadiness(result.data.commute.route);
      setIsCalculationReady(true);
    } catch {
      if (requestVersion !== calculationRequestVersion.current) return;
      setOfferError("Could not reach the analyzer. Check your connection and try again.");
      setStep("offer");
    }
  }

  async function changeScenarioDays(next: number) {
    if (next === 0 || route) {
      if (next === 0 && !route) routeRequestVersion.current += 1;
      setScenarioDays(next);
      setScenarioRouteState("idle");
      return;
    }
    if (!origin || !destination) return;

    // Keep rendering the last committed scenario while the first route for a
    // remote-to-onsite what-if is discovered; never present a zero-fare result
    // for an unresolved positive-day scenario.
    const requestVersion = ++routeRequestVersion.current;
    const requestedFareClass = fareClass;
    setScenarioRouteState("loading");
    try {
      const response = await fetch("/api/commute/route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin, destination, discountClass: requestedFareClass }),
      });
      const result = (await response.json()) as RoutePreviewResult;
      if (requestVersion !== routeRequestVersion.current) return;
      if (!result.success) throw new Error(result.error.message);
      const scenarioRoute = result.data.routes[0];
      if (!scenarioRoute) throw new Error("The transit provider returned no usable route.");
      setRouteCandidates(result.data.routes);
      setRoute(scenarioRoute);
      setResearchedRoutePlan(null);
      setScenarioDays(next);
      void loadFareConfirmations(scenarioRoute, requestedFareClass, requestVersion);
      void loadCommuteReadiness(scenarioRoute);
      setScenarioRouteState("idle");
    } catch {
      if (requestVersion === routeRequestVersion.current) setScenarioRouteState("error");
    }
  }

  /**
   * Applies a document read to the offer draft.
   *
   * It deliberately does not touch the priced route. A document can restate the
   * schedule, and the schedule is what the calculation reads, but the origin and
   * office pair is the user's own choice from step one — replacing it silently
   * would discard a route they already reviewed. A different office is offered as
   * an explicit action instead.
   */
  function applyExtraction(
    extraction: OfferDocumentExtraction,
    officeCandidates: readonly Location[],
  ) {
    const { fields } = extraction;
    const patch: Partial<OfferDraft> = {};
    if (fields.title !== null) patch.title = fields.title;
    if (fields.company !== null) patch.company = fields.company;
    if (fields.monthlySalary !== null) patch.salary = String(fields.monthlySalary);
    if (fields.workingHoursPerDay !== null) patch.workingHours = String(fields.workingHoursPerDay);

    const nextArrangement = fields.workArrangement ?? arrangement;
    if (fields.workArrangement !== null || fields.onsiteDaysPerWeek !== null) {
      patch.weeklySchedule = scheduleFromExtraction(
        nextArrangement,
        fields.onsiteDaysPerWeek,
        fields.workingDaysPerWeek,
        draft.weeklySchedule ?? scheduleForArrangement(arrangement),
      );
    }

    setAppliedExtraction({
      extraction,
      officeCandidates,
      previousDraft: draft,
      previousArrangement: arrangement,
    });
    setDraft((current) => ({ ...current, ...patch }));
    // A plain setter, not selectArrangement: see the note above on the route.
    setArrangement(nextArrangement);
    setOfferError(null);
  }

  function undoExtraction() {
    if (!appliedExtraction) return;
    setDraft(appliedExtraction.previousDraft);
    setArrangement(appliedExtraction.previousArrangement);
    setAppliedExtraction(null);
  }

  /** Switching office invalidates the priced route, so it returns to step one. */
  function useExtractedOffice(location: Location) {
    setAppliedExtraction(null);
    selectDestination(location);
    setStep("commute");
  }

  function rememberSetup() {
    const weeklySchedule = draft.weeklySchedule ?? scheduleForArrangement(arrangement);
    const workingHours = Number(draft.workingHours);
    const takeHome = Number(draft.takeHomePercent);
    const profile: CommuterProfileInput = {
      homeLabel: origin?.label ?? null,
      homeCoordinate: origin?.coordinate ?? null,
      fareClass,
      workArrangement: deriveWorkArrangement(weeklySchedule),
      workingHoursPerDay: Number.isFinite(workingHours) && workingHours > 0 ? workingHours : null,
      takeHomePercent: Number.isFinite(takeHome) && takeHome >= 50 ? takeHome : null,
      // Not inferred from the current trip: a commute the user priced is not the
      // same as a commute they said they could tolerate.
      maxOneWayMinutes: null,
    };
    void memory.remember(profile);
  }

  function applyRememberedSetup(profile: CommuterProfile) {
    setIsRememberedSetupDismissed(true);
    if (profile.homeLabel && profile.homeCoordinate) {
      selectOrigin({ label: profile.homeLabel, coordinate: profile.homeCoordinate });
    }
    if (profile.fareClass) selectFareClass(profile.fareClass);
    if (profile.workArrangement) selectArrangement(profile.workArrangement);
    setDraft((current) => ({
      ...current,
      workingHours:
        profile.workingHoursPerDay !== null
          ? String(profile.workingHoursPerDay)
          : current.workingHours,
      takeHomePercent:
        profile.takeHomePercent !== null
          ? String(profile.takeHomePercent)
          : current.takeHomePercent,
    }));
  }

  function rememberCurrentOffer() {
    if (!origin || !destination) return;
    void memory.rememberOffer(buildAnalyzePayload(origin, destination));
  }

  function returnToOfferFromCalculation() {
    calculationRequestVersion.current += 1;
    setIsCalculationReady(false);
    setStep("offer");
  }

  /**
   * "Start over" now closes the journey properly first.
   *
   * The reset itself is unchanged and still one click away; this only inserts the
   * closing beat, which is also where the reason to run a second offer lives.
   */
  function startComparison() {
    setHasCompared(true);
    setStep("compare");
  }

  /** Reached only from an explicit "Wrap up", never as a side effect of resetting. */
  function finishJourney() {
    setStep("outro");
    /*
     * Jumped, not smoothed. A smooth scroll runs for several hundred milliseconds
     * while the closing sequence is already playing, so the opening beats happen
     * off-screen and the animation looks like it started halfway through.
     */
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function revealReality() {
    if (!isCalculationReady) return;
    setIsCalculationReady(false);
    setStep("reality");
  }

  function enterJourney() {
    setIsIntroVisible(false);
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function reset() {
    routeRequestVersion.current += 1;
    readinessRequestVersion.current += 1;
    calculationRequestVersion.current += 1;
    setAnalysis(null);
    setResearchedRoutePlan(null);
    setFareConfirmations([]);
    setReadiness(null);
    setReadinessState("idle");
    setIsCalculationReady(false);
    setViabilityTargetIncome(0);
    setAppliedExtraction(null);
    setHasCompared(false);
    setStep("commute");
    setCommuteError(null);
    setOfferError(null);
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  // Every figure on the reality screen is derived by the domain layer, here.
  const scenario = analysis ? calculateJobScenario(analysis, scenarioDays, route) : null;
  const baselineScenario = analysis ? calculateJobScenario(analysis, baselineDays, route) : null;
  const scenarioCommute = calculateCommute(route, scenarioDays);
  const farePolicyImpact = analysis
    ? estimateSuspendedFareHikeImpact(route, scenarioDays, analysis.fareDiscountClass)
    : null;
  const viabilityPlan =
    analysis && route
      ? calculateCommuteViabilityPlan({
          analysis,
          route,
          targetIncomeAfterCommute: viabilityTargetIncome,
        })
      : null;

  return (
    <main className="app-shell text-ink print:bg-white">
      <div className="mx-auto max-w-[1320px] px-5 pt-4 pb-16 sm:px-8 lg:px-12">
        {/*
          The translucent blur is desktop-only on purpose. `backdrop-filter` on a
          sticky element is re-evaluated on every scroll frame, which is one of the
          most reliable ways to make a phone drop frames — and it competes directly
          with the scroll-triggered reveals further down the page. Small screens get
          an opaque bar instead, which looks near-identical and costs nothing.
        */}
        <header className="sticky top-0 z-30 -mx-5 mb-1 flex items-center justify-between gap-4 border-b border-ink/10 bg-canvas px-5 py-3.5 sm:-mx-8 sm:bg-canvas/85 sm:px-8 sm:backdrop-blur-md lg:-mx-12 lg:px-12 print:hidden">
          <button
            type="button"
            className="flex items-center gap-2.5 text-left"
            onClick={isIntroVisible ? enterJourney : reset}
            aria-label={
              isIntroVisible ? "Commute Lens — start planning" : "Commute Lens — start over"
            }
          >
            <span
              aria-hidden="true"
              className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-paper"
            >
              <Navigation className="size-4" />
            </span>
            <span className="font-headline text-sm leading-none font-black tracking-[0.16em]">
              COMMUTE LENS
            </span>
          </button>
          <div className="flex items-center gap-3">
            <p className="hidden text-right text-[0.68rem] leading-tight font-bold tracking-[0.1em] text-muted uppercase lg:block">
              Salary is the headline.
              <br />
              Commute reality tells the full story.
            </p>
            <MotionToggle
              reduceMotion={reduceMotion}
              systemPrefersReduced={systemPrefersReduced}
              onChange={setPreference}
            />
          </div>
        </header>

        {!isIntroVisible && <JourneyProgress activeIndex={PROGRESS_INDEX[step]} />}

        <AnimatePresence mode="wait">
          {isIntroVisible ? (
            <IntroPrelude key="intro" reduceMotion={reduceMotion} onEnter={enterJourney} />
          ) : (
            step === "commute" && (
              <Stage key="commute" reduceMotion={reduceMotion} entrance="zoom">
                {memory.profile && !isRememberedSetupDismissed && (
                  <RememberedSetupBanner
                    profile={memory.profile}
                    onApply={() => applyRememberedSetup(memory.profile as CommuterProfile)}
                    onForget={() => void memory.forget()}
                  />
                )}
                <CommuteSetupStage
                  idPrefix={formId}
                  origin={origin}
                  destination={destination}
                  onOriginChange={selectOrigin}
                  onDestinationChange={selectDestination}
                  arrangement={arrangement}
                  onArrangementChange={selectArrangement}
                  fareClass={fareClass}
                  onFareClassChange={selectFareClass}
                  isDiscovering={isDiscoveringRoute}
                  error={commuteError}
                  onContinue={() => void discoverRoute()}
                />
              </Stage>
            )
          )}

          {step === "route" && origin && destination && route && (
            <Stage key="route" reduceMotion={reduceMotion}>
              <RoutePreviewStage
                origin={origin}
                destination={destination}
                route={route}
                routes={routeCandidates}
                researchedRoutePlan={researchedRoutePlan}
                fareClass={fareClass}
                reduceMotion={reduceMotion}
                fareConfirmations={fareConfirmations}
                onConfirmFare={confirmRouteFare}
                onRouteSelect={selectPreviewRoute}
                onResearchedRoutePlanChange={setResearchedRoutePlan}
                onBack={() => setStep("commute")}
                onContinue={() => setStep("offer")}
              />
            </Stage>
          )}

          {step === "offer" && origin && destination && (
            <Stage key="offer" reduceMotion={reduceMotion}>
              <div className="grid gap-4 pt-6 lg:pt-10">
                <OfferDocumentUpload reduceMotion={reduceMotion} onApply={applyExtraction} />
                {appliedExtraction && (
                  <ExtractionNotice
                    extraction={appliedExtraction.extraction}
                    officeCandidates={appliedExtraction.officeCandidates}
                    currentOfficeLabel={destination.label}
                    onUseOffice={useExtractedOffice}
                    onUndo={undoExtraction}
                  />
                )}
              </div>
              <OfferDetailsStage
                idPrefix={formId}
                origin={origin}
                destination={destination}
                route={route}
                draft={draft}
                onDraftChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
                serverError={offerError}
                onBack={() => setStep(route ? "route" : "commute")}
                onSubmit={() => void calculate()}
              />
            </Stage>
          )}

          {step === "calculating" && (
            <Stage key="calculating" reduceMotion={reduceMotion}>
              <CalculatingStage
                route={route}
                onsiteDays={countOnsiteDays(
                  draft.weeklySchedule ?? scheduleForArrangement(arrangement),
                )}
                reduceMotion={reduceMotion}
                isReady={isCalculationReady}
                onBack={returnToOfferFromCalculation}
                onReveal={revealReality}
              />
            </Stage>
          )}

          {step === "reality" && analysis && scenario && baselineScenario && (
            <Stage key="reality" reduceMotion={reduceMotion} entrance="reveal">
              {/*
                A single concise announcement when a result arrives. It reads the
                baseline scenario, not the live slider value, so exploring what-ifs
                does not turn into a stream of interruptions.
              */}
              <p role="status" className="sr-only">
                Result ready. Estimated take-home after transport:{" "}
                {formatPeso(baselineScenario.incomeAfterCommute)} per month.
              </p>
              <RealityStage
                analysis={analysis}
                scenario={scenario}
                commute={scenarioCommute}
                baselineDays={baselineDays}
                scenarioDays={scenarioDays}
                scenarioDelta={diffJobScenarios(baselineScenario, scenario)}
                farePolicyImpact={farePolicyImpact}
                fareConfirmations={fareConfirmations}
                researchedRoutePlan={researchedRoutePlan}
                activeScenarioRoute={route}
                scenarioRouteState={scenarioRouteState}
                readiness={readiness}
                readinessState={readinessState}
                viabilityPlan={viabilityPlan}
                viabilityTargetIncome={viabilityTargetIncome}
                onScenarioDaysChange={(days) => void changeScenarioDays(days)}
                onViabilityTargetIncomeChange={setViabilityTargetIncome}
                onResearchedRoutePlanChange={setResearchedRoutePlan}
                reduceMotion={reduceMotion}
                onEdit={() => setStep("offer")}
                onCompare={startComparison}
                /* "Start over" means start over. Finishing has its own control. */
                onReset={reset}
              />
              <CommuterMemoryPanel
                memory={memory}
                onRememberSetup={rememberSetup}
                onRememberOffer={rememberCurrentOffer}
                onForgetOffer={(offerId) => void memory.forgetOffer(offerId)}
                onForgetAll={() => void memory.forget()}
              />
              <JourneyWrapUp
                context="reality"
                reduceMotion={reduceMotion}
                onFinish={finishJourney}
              />
            </Stage>
          )}

          {step === "outro" && analysis && baselineScenario && (
            <Stage key="outro" reduceMotion={reduceMotion} entrance="own">
              <JourneyOutro
                title={analysis.jobOffer.title}
                company={analysis.jobOffer.company}
                incomeAfterCommute={baselineScenario.incomeAfterCommute}
                monthlyCommuteHours={analysis.monthlyCommuteHours}
                rememberedOffers={memory.offers.length}
                hasCompared={hasCompared}
                reduceMotion={reduceMotion}
                onBackToResult={() => setStep(hasCompared ? "compare" : "reality")}
                onPlanAnother={reset}
              />
            </Stage>
          )}

          {step === "compare" && analysis && (
            <Stage key="compare" reduceMotion={reduceMotion}>
              <ComparisonStage
                jobA={analysis}
                reduceMotion={reduceMotion}
                onBack={() => setStep("reality")}
              />
              <JourneyWrapUp
                context="compare"
                reduceMotion={reduceMotion}
                onFinish={finishJourney}
              />
            </Stage>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

/**
 * Stage transitions use opacity, transform, and blur only, so nothing reflows.
 *
 * Every screen arrives with the same gesture — rise slightly, resolve out of a
 * blur, settle on a spring — because a journey where each step enters differently
 * feels like a set of unrelated pages. Only the intensity varies:
 *
 *  - `reveal` is for a screen that is the answer to something (the result).
 *  - `zoom` is for the first step, which has no predecessor to continue from.
 *  - `own` is for screens that choreograph their own arrival, like the outro.
 *    Animating the wrapper too would compound transforms and read as a wobble.
 *
 * Exits are a quick fade with a touch of blur. Leaving is not worth watching, and
 * `AnimatePresence mode="wait"` means every exit is time the next screen spends
 * waiting.
 */
function Stage({
  children,
  reduceMotion,
  entrance = "slide",
}: {
  children: ReactNode;
  reduceMotion: boolean;
  entrance?: "slide" | "zoom" | "reveal" | "own";
}) {
  const isSelfChoreographed = entrance === "own";

  const arrival = isSelfChoreographed
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.24 } }
    : materialize(reduceMotion, {
        distance: entrance === "reveal" ? 30 : entrance === "zoom" ? 20 : 16,
        scale: entrance === "zoom" ? 0.94 : entrance === "reveal" ? 0.97 : 0.99,
        transition: entrance === "reveal" ? SPRING_CINEMATIC : SPRING_SMOOTH,
      });

  return (
    <motion.div
      initial={arrival.initial}
      animate={arrival.animate}
      /* The exit carries its own timing so it stays brisk instead of inheriting
         the entrance spring, which would hold up the incoming screen. */
      exit={
        reduceMotion
          ? { opacity: 0, transition: { duration: 0.08 } }
          : {
              opacity: 0,
              y: -12,
              scale: 0.99,
              transition: { duration: 0.22, ease: EASE_EXIT },
            }
      }
      transition={reduceMotion ? { duration: 0.08 } : (arrival.transition ?? { duration: 0.24 })}
    >
      {children}
    </motion.div>
  );
}
