"use client";

import {
  ArrowLeft,
  ArrowRight,
  BadgePercent,
  Check,
  Clock3,
  LoaderCircle,
  Repeat,
  Sparkles,
  Wallet,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { CommuteRecommendationResult } from "@/app/api/commute/recommend/route";
import {
  getCommuteGuideEligibility,
  type CommuteRouteRecommendation,
} from "@/application/guide-commute/commute-guide";
import type { ResearchedCommuteRoutePlan } from "@/application/research-commute-route/research-route";
import type { FareConfirmationSummary } from "@/application/fare-confirmation/fare-confirmation.service";
import { ActionButton } from "@/components/ui/action-button";
import { Eyebrow } from "@/components/ui/typography";
import { describeFareDiscount, type FareDiscountClass } from "@/domain/fare";
import type { CommuteRoute, Location } from "@/domain/models";
import { formatMinutes, formatPeso, shortPlace, transferLabel } from "./format";
import { JourneyStory } from "./journey-story";
import { describeRouteStatus, reliabilityLabel, routeStatusMeaning } from "./provenance";
import { RouteMap } from "./route-map";
import { RouteResearchPanel } from "./route-research-panel";
import { RouteStatusBadge } from "./route-status-badge";

function Fact({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="p-5">
      <dt className="flex items-center gap-2 text-[0.62rem] font-black tracking-[0.16em] text-muted uppercase">
        <span aria-hidden="true" className="text-flame [&>svg]:size-3.5">
          {icon}
        </span>
        {label}
      </dt>
      <dd className="mt-2">
        <span className="numeric block font-headline text-[1.75rem] leading-none font-black tracking-[-0.03em]">
          {value}
        </span>
        <span className="mt-1.5 block text-[0.7rem] leading-snug text-muted">{detail}</span>
      </dd>
    </div>
  );
}

function RouteChoices({
  routes,
  route,
  onRouteSelect,
}: {
  routes: readonly CommuteRoute[];
  route: CommuteRoute;
  onRouteSelect: (route: CommuteRoute) => void;
}) {
  const [recommendation, setRecommendation] = useState<CommuteRouteRecommendation | null>(null);
  const [isRecommending, setIsRecommending] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const providerRoutes = routes.filter(
    (candidate) => getCommuteGuideEligibility(candidate).isEligible,
  );
  const estimatedOnly = routes.length > 0 && providerRoutes.length === 0;

  async function requestRecommendation() {
    setIsRecommending(true);
    setRecommendationError(null);
    try {
      const response = await fetch("/api/commute/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routes }),
      });
      const result = (await response.json()) as CommuteRecommendationResult;
      if (!result.success) throw new Error(result.error.message);
      setRecommendation(result.data);
      const recommendedRoute =
        result.data.option === null ? null : providerRoutes[result.data.option - 1];
      if (recommendedRoute) onRouteSelect(recommendedRoute);
    } catch (error) {
      setRecommendationError(
        error instanceof Error ? error.message : "AI could not compare the available routes.",
      );
    } finally {
      setIsRecommending(false);
    }
  }

  if (estimatedOnly) {
    return (
      <section className="app-panel mt-6 border-sand/55 bg-sand/10 p-5">
        <Eyebrow>Route recommendation unavailable</Eyebrow>
        <h2 className="mt-2 font-headline text-xl font-black tracking-[-0.03em]">
          No provider itinerary was found
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          The time and fare below are distance-based estimates, not a real transit route. AI cannot
          responsibly recommend a vehicle, service, stop, or path from this data.
        </p>
      </section>
    );
  }

  if (routes.length < 2) {
    return (
      <section className="app-panel mt-6 bg-mint/25 p-5">
        <Eyebrow>Provider itinerary</Eyebrow>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The provider returned one itinerary for this trip. Review the listed legs before using it
          to price your commute.
        </p>
      </section>
    );
  }

  return (
    <section className="app-panel mt-6 overflow-hidden">
      <div className="border-b border-ink/10 bg-mint/25 p-5">
        <Eyebrow>Choose a provider itinerary</Eyebrow>
        <h2 className="mt-2 font-headline text-xl font-black tracking-[-0.03em]">
          Compare the available ways to travel
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          AI can recommend one of these provider-returned options using only the listed time, fare,
          transfers, and broad transport modes. It cannot create a new route or name an unreported
          service.
        </p>
      </div>

      <div className="grid divide-y divide-ink/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {routes.map((candidate, index) => {
          const isSelected = candidate.id === route.id;
          const status = describeRouteStatus(candidate);
          return (
            <button
              key={candidate.id}
              type="button"
              className={`p-4 text-left transition-colors ${
                isSelected ? "bg-ink text-paper" : "bg-paper hover:bg-canvas/70"
              }`}
              onClick={() => onRouteSelect(candidate)}
              aria-pressed={isSelected}
            >
              <span className="flex items-center justify-between gap-3 text-[0.65rem] font-black tracking-[0.12em] uppercase">
                Option {index + 1}
                {isSelected && <Check className="size-4" aria-label="Selected" />}
              </span>
              <span className="numeric mt-3 block font-headline text-xl font-black">
                {formatMinutes(candidate.oneWayDurationMinutes)}
              </span>
              <span
                className={`numeric mt-1 block text-xs ${isSelected ? "text-paper/70" : "text-muted"}`}
              >
                {formatPeso(candidate.oneWayFare)} · {transferLabel(candidate.transfers)}
              </span>
              <span
                className={`mt-2 block text-[0.67rem] leading-snug ${isSelected ? "text-paper/70" : "text-muted"}`}
              >
                {status.kind === "live"
                  ? `${candidate.segments.map((segment) => segment.mode).join(" → ")}`
                  : status.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="ai-module-inset m-4 p-4 sm:p-5">
        <span className="ai-badge">
          <Sparkles className="size-3" aria-hidden="true" /> Optional AI · ranks existing options
        </span>
        <p className="mt-2 mb-3 max-w-xl text-xs leading-relaxed text-muted">
          AI compares only the provider options above. It cannot create or reprice a route.
        </p>
        <ActionButton
          variant="secondary"
          onClick={() => void requestRecommendation()}
          disabled={isRecommending}
        >
          {isRecommending ? (
            <>
              <LoaderCircle className="size-3.5 motion-safe:animate-spin" aria-hidden="true" />
              Comparing options…
            </>
          ) : (
            <>
              <Sparkles className="size-3.5" aria-hidden="true" />
              Ask AI to recommend an option
            </>
          )}
        </ActionButton>
        <div aria-live="polite">
          {recommendation && (
            <p className="mt-3 rounded-[0.9rem] bg-mint/50 p-3 text-sm leading-relaxed">
              {recommendation.text}
            </p>
          )}
          {recommendationError && (
            <p role="alert" className="field-error mt-3">
              {recommendationError}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Stage two. Provider candidates are preserved here instead of silently taking
 * candidate zero. The user or constrained AI recommendation chooses which
 * itinerary drives all later fare, salary, and readiness calculations.
 */
export function RoutePreviewStage({
  origin,
  destination,
  route,
  routes,
  researchedRoutePlan,
  fareClass,
  reduceMotion,
  fareConfirmations,
  onConfirmFare,
  onRouteSelect,
  onResearchedRoutePlanChange,
  onBack,
  onContinue,
}: {
  origin: Location;
  destination: Location;
  route: CommuteRoute;
  routes: readonly CommuteRoute[];
  researchedRoutePlan: ResearchedCommuteRoutePlan | null;
  fareClass: FareDiscountClass;
  reduceMotion: boolean;
  fareConfirmations: readonly FareConfirmationSummary[];
  onConfirmFare: (segmentIndex: number, observedFare: number) => Promise<string | null>;
  onRouteSelect: (route: CommuteRoute) => void;
  onResearchedRoutePlanChange: (plan: ResearchedCommuteRoutePlan | null) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const status = describeRouteStatus(route);
  const fareDiscount = describeFareDiscount(fareClass);

  return (
    <div className="mx-auto max-w-4xl pt-6 lg:pt-10">
      <button type="button" className="back-link" onClick={onBack}>
        <ArrowLeft className="size-4" aria-hidden="true" /> Edit commute
      </button>

      <header className="mt-5">
        <Eyebrow>Step two · route options</Eyebrow>
        <h1 className="mt-3 font-headline text-[clamp(2.1rem,6vw,4rem)] leading-[0.92] font-black tracking-[-0.05em]">
          {shortPlace(origin.label)}{" "}
          <span className="font-highlight font-normal text-accent italic">to</span>{" "}
          {shortPlace(destination.label)}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          Choose the provider itinerary that should price your commute. If there are multiple
          provider options, AI can compare only those returned options—it does not create routes.
        </p>
      </header>

      <RouteChoices routes={routes} route={route} onRouteSelect={onRouteSelect} />

      <section className="app-panel mt-7 overflow-hidden">
        <dl className="grid divide-y divide-ink/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Fact
            icon={<Clock3 />}
            label="One way"
            value={formatMinutes(route.oneWayDurationMinutes)}
            detail={
              status.kind === "estimated"
                ? "Distance-based estimate, not an itinerary"
                : "From the provider itinerary"
            }
          />
          <Fact
            icon={<Wallet />}
            label="One-way fare"
            value={formatPeso(route.oneWayFare)}
            detail="Estimated, counted twice each office day"
          />
          <Fact
            icon={<Repeat />}
            label="Transfers"
            value={transferLabel(route.transfers)}
            detail={
              route.transfers === 0
                ? "No transit transfers counted; access walking may still be included"
                : `${reliabilityLabel(route.reliability)} reported by the route provider`
            }
          />
        </dl>
        <div className="flex flex-col items-stretch gap-3 border-t border-ink/10 bg-canvas/60 p-5 sm:flex-row sm:flex-wrap sm:items-start">
          <RouteStatusBadge className="w-fit max-w-full shrink-0" status={status} />
          {fareDiscount.rate > 0 && (
            <span className="status-chip w-fit max-w-full shrink-0" data-tone="neutral">
              <BadgePercent className="size-3.5 shrink-0" aria-hidden="true" />
              {fareDiscount.shortLabel} · −{Math.round(fareDiscount.rate * 100)}%
            </span>
          )}
          <p className="min-w-0 flex-1 text-[0.72rem] leading-relaxed text-muted">
            {routeStatusMeaning(status.kind)} Fares are priced per leg from an estimated road
            distance, using the LTFRB jeepney matrix where it applies and estimated bands elsewhere.
          </p>
        </div>
      </section>

      <div className="mt-5">
        <JourneyStory
          route={route}
          reduceMotion={reduceMotion}
          fareConfirmations={fareConfirmations}
          onConfirmFare={onConfirmFare}
        />
      </div>

      <div className="mt-5">
        <RouteResearchPanel
          route={route}
          plan={researchedRoutePlan}
          onPlanChange={onResearchedRoutePlanChange}
        />
      </div>

      <div className="mt-5">
        <RouteMap route={route} />
      </div>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ActionButton variant="secondary" onClick={onBack}>
          Try different locations
        </ActionButton>
        <div className="sm:text-right">
          <ActionButton className="w-full sm:w-auto" onClick={onContinue}>
            Use this itinerary
            <ArrowRight className="size-4" aria-hidden="true" />
          </ActionButton>
          <p className="mt-2 text-[0.68rem] text-muted">
            Next: salary, hours, and how many days you would be onsite.
          </p>
        </div>
      </div>
    </div>
  );
}
