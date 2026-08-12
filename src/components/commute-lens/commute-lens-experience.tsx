"use client";

import { AnimatePresence, motion } from "motion/react";
import { Navigation } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";
import type { CommuteReadinessResult } from "@/app/api/commute/readiness/route";
import type { FareConfirmationResult } from "@/app/api/fare-confirmations/route";
import type { CommuteReadiness } from "@/application/assess-commute-readiness/use-case";
import type { FareConfirmationSummary } from "@/application/fare-confirmation/fare-confirmation.service";
import type { AnalyzeJobOfferResult } from "@/application/analyze-job-offer/use-case";
import type { RoutePreviewResult } from "@/app/api/commute/route/route";
import { PRIMARY_DEMO_SCENARIO } from "@/data/demo";
import { calculateCommute } from "@/domain/commute/calculations";
import { estimateSuspendedFareHikeImpact, type FareDiscountClass } from "@/domain/fare";
import { calculateCommuteViabilityPlan } from "@/domain/job/commute-viability";
import { calculateJobScenario, diffJobScenarios } from "@/domain/job/scenario";
import type { CommuteRoute, JobRealityAnalysis, Location, WorkArrangement } from "@/domain/models";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
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

type Step = "commute" | "route" | "offer" | "calculating" | "reality" | "compare";

const PROGRESS_INDEX: Record<Step, number> = {
  commute: 0,
  route: 0,
  offer: 1,
  calculating: 1,
  reality: 2,
  compare: 3,
};

const seed = PRIMARY_DEMO_SCENARIO;

function arrangementDays(arrangement: WorkArrangement, current: number) {
  if (arrangement === "remote") return 0;
  if (arrangement === "onsite") return 5;
  return Math.min(4, Math.max(1, current || 3));
}

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
  const reduceMotion = usePrefersReducedMotion();
  const formId = useId();
  const resultRef = useRef<HTMLDivElement>(null);
  const routeRequestVersion = useRef(0);
  const readinessRequestVersion = useRef(0);

  const [step, setStep] = useState<Step>("commute");
  const [isIntroVisible, setIsIntroVisible] = useState(true);
  const [origin, setOrigin] = useState<Location | null>(null);
  const [destination, setDestination] = useState<Location | null>(null);
  const [route, setRoute] = useState<CommuteRoute | null>(null);
  const [isDiscoveringRoute, setIsDiscoveringRoute] = useState(false);
  const [commuteError, setCommuteError] = useState<string | null>(null);

  const [draft, setDraft] = useState<OfferDraft>({
    title: seed.jobOffer.title,
    company: seed.jobOffer.company,
    salary: String(seed.jobOffer.monthlySalary),
    workingHours: "8",
    takeHomePercent: "90",
  });
  const [arrangement, setArrangement] = useState<WorkArrangement>("hybrid");
  const [onsiteDays, setOnsiteDays] = useState(3);
  const [fareClass, setFareClass] = useState<FareDiscountClass>("regular");
  const [fareConfirmations, setFareConfirmations] = useState<readonly FareConfirmationSummary[]>(
    [],
  );
  const [offerError, setOfferError] = useState<string | null>(null);

  const [analysis, setAnalysis] = useState<JobRealityAnalysis | null>(null);
  const [baselineDays, setBaselineDays] = useState(3);
  const [scenarioDays, setScenarioDays] = useState(3);
  const [scenarioRouteState, setScenarioRouteState] = useState<"idle" | "loading" | "error">(
    "idle",
  );
  const [readiness, setReadiness] = useState<CommuteReadiness | null>(null);
  const [readinessState, setReadinessState] = useState<"idle" | "loading" | "unavailable">(
    "idle",
  );
  const [viabilityTargetIncome, setViabilityTargetIncome] = useState(0);

  function invalidateRoute() {
    routeRequestVersion.current += 1;
    readinessRequestVersion.current += 1;
    setRoute(null);
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
    setOnsiteDays(arrangementDays(next, onsiteDays));
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
      setFareConfirmations([]);
      setCommuteError(null);
      setStep("offer");
      return;
    }
    const requestVersion = ++routeRequestVersion.current;
    const requestedFareClass = fareClass;
    setCommuteError(null);
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
      setRoute(result.data.route);
      void loadFareConfirmations(result.data.route, requestedFareClass, requestVersion);
      setStep("route");
    } catch {
      if (requestVersion === routeRequestVersion.current) {
        setCommuteError("Could not discover this route. Check your connection and try again.");
      }
    } finally {
      if (requestVersion === routeRequestVersion.current) setIsDiscoveringRoute(false);
    }
  }

  async function calculate() {
    if (!origin || !destination) {
      setOfferError("Choose an origin and destination before calculating.");
      return;
    }
    setOfferError(null);
    setStep("calculating");

    const payload = {
      origin,
      route,
      discountClass: fareClass,
      jobOffer: {
        id: `job-${crypto.randomUUID()}`,
        title: draft.title.trim(),
        company: draft.company.trim(),
        monthlySalary: Number(draft.salary),
        officeLocation: destination,
        workArrangement: arrangement,
        onsiteDaysPerWeek: onsiteDays,
        workingHoursPerDay: Number(draft.workingHours),
        estimatedTakeHomeRate: Number(draft.takeHomePercent) / 100,
      },
    };

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
        new Promise((resolve) => setTimeout(resolve, reduceMotion ? 120 : 1150)),
      ]);
      const result = (await response.json()) as AnalyzeJobOfferResult;
      if (!result.success) {
        setOfferError(result.error.message);
        setStep("offer");
        return;
      }
      setAnalysis(result.data);
      setBaselineDays(onsiteDays);
      setScenarioDays(onsiteDays);
      setViabilityTargetIncome(Math.max(0, result.data.incomeAfterCommute));
      setScenarioRouteState("idle");
      void loadCommuteReadiness(result.data.commute.route);
      setStep("reality");
      setTimeout(
        () => resultRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" }),
        80,
      );
    } catch {
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
      setRoute(result.data.route);
      setScenarioDays(next);
      void loadFareConfirmations(result.data.route, requestedFareClass, requestVersion);
      void loadCommuteReadiness(result.data.route);
      setScenarioRouteState("idle");
    } catch {
      if (requestVersion === routeRequestVersion.current) setScenarioRouteState("error");
    }
  }

  function enterJourney() {
    setIsIntroVisible(false);
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function reset() {
    routeRequestVersion.current += 1;
    readinessRequestVersion.current += 1;
    setAnalysis(null);
    setFareConfirmations([]);
    setReadiness(null);
    setReadinessState("idle");
    setViabilityTargetIncome(0);
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
        <header
          className="sticky top-0 z-30 -mx-5 mb-1 flex items-center justify-between gap-4 border-b border-ink/10 bg-canvas/85 px-5 py-3.5 backdrop-blur-md sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12 print:hidden"
        >
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
          <p className="hidden text-right text-[0.68rem] leading-tight font-bold tracking-[0.1em] text-muted uppercase sm:block">
            Salary is the headline.
            <br />
            Commute reality tells the full story.
          </p>
        </header>

        {!isIntroVisible && <JourneyProgress activeIndex={PROGRESS_INDEX[step]} />}

        <AnimatePresence mode="wait">
          {isIntroVisible ? (
            <IntroPrelude
              key="intro"
              reduceMotion={reduceMotion}
              onEnter={enterJourney}
            />
          ) : (
            step === "commute" && (
              <Stage key="commute" reduceMotion={reduceMotion} entrance="zoom">
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
                fareClass={fareClass}
                reduceMotion={reduceMotion}
                fareConfirmations={fareConfirmations}
                onConfirmFare={confirmRouteFare}
                onBack={() => setStep("commute")}
                onContinue={() => setStep("offer")}
              />
            </Stage>
          )}

          {step === "offer" && origin && destination && (
            <Stage key="offer" reduceMotion={reduceMotion}>
              <OfferDetailsStage
                idPrefix={formId}
                origin={origin}
                destination={destination}
                route={route}
                draft={draft}
                onDraftChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
                arrangement={arrangement}
                onArrangementChange={selectArrangement}
                onsiteDays={onsiteDays}
                onOnsiteDaysChange={setOnsiteDays}
                serverError={offerError}
                onBack={() => setStep(route ? "route" : "commute")}
                onSubmit={() => void calculate()}
              />
            </Stage>
          )}

          {step === "calculating" && (
            <Stage key="calculating" reduceMotion={reduceMotion}>
              <CalculatingStage route={route} onsiteDays={onsiteDays} reduceMotion={reduceMotion} />
            </Stage>
          )}

          {step === "reality" && analysis && scenario && baselineScenario && (
            <Stage key="reality" reduceMotion={reduceMotion}>
              <div ref={resultRef}>
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
                  activeScenarioRoute={route}
                  scenarioRouteState={scenarioRouteState}
                  readiness={readiness}
                  readinessState={readinessState}
                  viabilityPlan={viabilityPlan}
                  viabilityTargetIncome={viabilityTargetIncome}
                  onScenarioDaysChange={(days) => void changeScenarioDays(days)}
                  onViabilityTargetIncomeChange={setViabilityTargetIncome}
                  reduceMotion={reduceMotion}
                  onEdit={() => setStep("offer")}
                  onCompare={() => setStep("compare")}
                  onPrint={() => window.print()}
                  onReset={reset}
                />
              </div>
            </Stage>
          )}

          {step === "compare" && analysis && (
            <Stage key="compare" reduceMotion={reduceMotion}>
              <ComparisonStage
                jobA={analysis}
                reduceMotion={reduceMotion}
                onBack={() => setStep("reality")}
              />
            </Stage>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

/** Stage transitions use opacity and transforms only, so nothing reflows. */
function Stage({
  children,
  reduceMotion,
  entrance = "slide",
}: {
  children: ReactNode;
  reduceMotion: boolean;
  entrance?: "slide" | "zoom";
}) {
  const isZoomEntrance = entrance === "zoom";

  return (
    <motion.div
      initial={
        reduceMotion
          ? { opacity: 0 }
          : isZoomEntrance
            ? { opacity: 0, scale: 0.9, y: 18 }
            : { opacity: 0, x: 16 }
      }
      animate={
        isZoomEntrance ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, x: 0 }
      }
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -16 }}
      transition={{
        duration: reduceMotion ? 0.08 : isZoomEntrance ? 0.46 : 0.28,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
