"use client";

import {
  Bike,
  Bus,
  Footprints,
  LoaderCircle,
  MapPin,
  MessageSquareQuote,
  Milestone,
  ShieldCheck,
  Sparkles,
  Train,
} from "lucide-react";
import { useState } from "react";
import type { CommuteGuideResult } from "@/app/api/commute/guide/route";
import {
  getCommuteGuideEligibility,
  type CommuteGuideDegradedReason,
} from "@/application/guide-commute/commute-guide";
import { ActionButton } from "@/components/ui/action-button";
import { Eyebrow } from "@/components/ui/typography";
import type { CommuteRoute, TransportMode } from "@/domain/models";
import { formatMinutes, formatPeso, modeLabel, shortPlace, transferLabel } from "./format";
import { describeRouteStatus } from "./provenance";
import { RouteStatusBadge } from "./route-status-badge";

function modeIcon(mode: TransportMode) {
  switch (mode) {
    case "rail":
      return <Train />;
    case "walk":
      return <Footprints />;
    case "tricycle":
      return <Bike />;
    case "bus":
    case "jeepney":
    case "uv-express":
    case "p2p":
      return <Bus />;
    default:
      return <Milestone />;
  }
}

function segmentInstruction(mode: TransportMode, origin: string, destination: string): string {
  const from = shortPlace(origin);
  const to = shortPlace(destination);

  if (mode === "walk") return `Walk from ${from} to ${to}.`;
  return `Take ${modeLabel(mode).toLowerCase()} from ${from} to ${to}.`;
}

function degradedReasonCopy(reason: CommuteGuideDegradedReason | undefined): string {
  switch (reason) {
    case "no-verified-itinerary":
      return "No provider itinerary is available, so AI cannot recommend a route.";
    case "not-configured":
      return "AI is not configured on this server.";
    case "timeout":
      return "AI wording timed out; showing the route-fact guide.";
    case "upstream":
      return "AI could not return usable wording; showing the route-fact guide.";
    case "malformed":
      return "AI returned an unsupported response format; showing the route-fact guide.";
    case "guardrail":
      return "AI wording did not pass route-fact checks; showing the verified route-fact guide.";
    default:
      return "AI wording was unavailable; showing the route-fact guide.";
  }
}

/**
 * Converts the selected, ordered route segments into readable commuter steps.
 * Closed-world AI can reword a provider itinerary; the separate research panel
 * owns optional web search and cited service details.
 */
export function CommuteDirectionsCard({ route }: { route: CommuteRoute | null }) {
  const [guide, setGuide] = useState<{
    routeId: string;
    source: "ai" | "deterministic" | "unavailable";
    text: string;
    degradedReason?: CommuteGuideDegradedReason;
  } | null>(null);
  const [isLoadingGuide, setIsLoadingGuide] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);

  if (!route || route.segments.length === 0) {
    return (
      <section className="app-panel p-5 sm:p-6">
        <Eyebrow>How to make this commute</Eyebrow>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Add an onsite route to see practical commute steps for this scenario.
        </p>
      </section>
    );
  }

  const selectedRoute = route;
  const status = describeRouteStatus(selectedRoute);
  const guideEligibility = getCommuteGuideEligibility(selectedRoute);
  const hasTransitLeg = selectedRoute.segments.some((segment) => segment.mode !== "walk");
  const visibleGuide = guide?.routeId === selectedRoute.id ? guide : null;

  async function requestAiGuide() {
    setIsLoadingGuide(true);
    setGuideError(null);
    try {
      const response = await fetch("/api/commute/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route: selectedRoute }),
      });
      const result = (await response.json()) as CommuteGuideResult;
      if (!result.success) throw new Error(result.error.message);
      setGuide({
        routeId: selectedRoute.id,
        source: result.data.source,
        text: result.data.text,
        degradedReason: result.data.degradedReason,
      });
    } catch (error) {
      setGuideError(error instanceof Error ? error.message : "The commute guide is unavailable.");
    } finally {
      setIsLoadingGuide(false);
    }
  }

  return (
    <section className="app-panel overflow-hidden print:hidden">
      <div className="border-b border-ink/10 bg-canvas/65 p-5 sm:p-6">
        <Eyebrow>How to make this commute</Eyebrow>
        <h2 className="mt-2 font-headline text-2xl font-black tracking-[-0.035em]">
          Your selected route, step by step
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          These steps come from the itinerary used to price your commute. Check them before you rely
          on the estimate.
        </p>
      </div>

      {status.kind === "estimated" ? (
        <div className="px-5 py-5 sm:px-6">
          <p className="text-[0.62rem] font-black tracking-[0.14em] text-flame uppercase">
            No provider itinerary found
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed font-bold">
            The displayed time and fare are distance-based estimates between your locations, not a
            confirmed transport route.
          </p>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted">
            Commute Lens cannot tell you which vehicle, service, stop, or path to take for this
            corridor. Check a local operator or map before using this estimate to make a decision.
          </p>
        </div>
      ) : (
        <ol className="divide-y divide-ink/10 px-5 sm:px-6" aria-label="Selected commute steps">
          {route.segments.map((segment, index) => (
            <li
              key={`${segment.origin.label}-${segment.destination.label}-${index}`}
              className="py-4"
            >
              <div className="flex gap-3.5">
                <span
                  aria-hidden="true"
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-paper [&>svg]:size-4"
                >
                  {modeIcon(segment.mode)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-[0.62rem] font-black tracking-[0.14em] text-flame uppercase">
                      Step {index + 1} · {modeLabel(segment.mode)}
                    </p>
                    <p className="numeric text-xs font-bold text-muted">
                      {formatMinutes(segment.estimatedDurationMinutes)}
                      {segment.estimatedFare > 0 ? ` · ${formatPeso(segment.estimatedFare)}` : ""}
                    </p>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed font-bold">
                    {segmentInstruction(
                      segment.mode,
                      segment.origin.label,
                      segment.destination.label,
                    )}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3 border-t border-ink/10 bg-paper p-5 sm:px-6">
        <p className="max-w-xl text-xs leading-relaxed text-muted">
          {hasTransitLeg && route.transfers === 0
            ? "No transit transfers were counted. You may still need to walk to or from the stop."
            : hasTransitLeg
              ? `${transferLabel(route.transfers)} counted between transit legs. Walking may also be part of the trip.`
              : "This itinerary uses walking only; no transit transfers were counted."}
        </p>
        <RouteStatusBadge status={status} />
      </div>

      <div className="ai-module-inset m-3 p-4 sm:m-4 sm:p-5">
        {guideEligibility.isEligible ? (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <span className="ai-badge">
                  <Sparkles className="size-3" aria-hidden="true" /> Optional AI
                </span>
                <p className="mt-3 text-sm font-bold">
                  Turn this itinerary into plain-language steps
                </p>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted">
                  Ask AI to explain the selected itinerary. It is restricted to the
                  provider-returned legs, times, fares, and transfer count shown above.
                </p>
              </div>
              <ActionButton
                variant="secondary"
                onClick={() => void requestAiGuide()}
                disabled={isLoadingGuide}
              >
                {isLoadingGuide ? (
                  <>
                    <LoaderCircle
                      className="size-3.5 motion-safe:animate-spin"
                      aria-hidden="true"
                    />
                    Writing…
                  </>
                ) : (
                  <>
                    <MessageSquareQuote className="size-3.5" aria-hidden="true" />
                    {visibleGuide ? "Rewrite guide" : "Explain this route with AI"}
                  </>
                )}
              </ActionButton>
            </div>

            <div aria-live="polite">
              {visibleGuide && (
                <div className="mt-4 rounded-[1.1rem] bg-mint/50 p-4">
                  <p className="text-sm leading-relaxed">{visibleGuide.text}</p>
                  <p className="mt-3 flex items-center gap-1.5 text-[0.62rem] font-black tracking-[0.1em] text-ink/70 uppercase">
                    <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
                    {visibleGuide.source === "ai"
                      ? "AI route wording · checked against provider itinerary facts"
                      : degradedReasonCopy(visibleGuide.degradedReason)}
                  </p>
                </div>
              )}
              {guideError && (
                <p role="alert" className="field-error mt-3">
                  {guideError}
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-[1.1rem] bg-sand/15 p-4">
            <p className="text-sm font-bold">Provider-itinerary explanation unavailable.</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              This priced result has no provider itinerary to explain. Use the separate AI web
              research panel below to search public sources for a cited practical route.
            </p>
          </div>
        )}
      </div>

      <p className="flex items-start gap-2 border-t border-ink/10 px-5 py-3.5 text-[0.68rem] leading-relaxed text-muted sm:px-6">
        <MapPin className="mt-0.5 size-3.5 shrink-0 text-flame" aria-hidden="true" />
        <span>
          The provider summary above is not live navigation. The separate researched plan may add
          cited service details from public web sources; verify them before travelling.
        </span>
      </p>
    </section>
  );
}
