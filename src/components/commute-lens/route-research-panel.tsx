"use client";

import { ExternalLink, LoaderCircle, MapPinned, Search, ShieldAlert } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import type { CommuteRoutePlanResult } from "@/app/api/commute/route-plan/route";
import {
  routeResearchFingerprint,
  type ResearchedCommuteRoutePlan,
} from "@/application/research-commute-route/research-route";
import { ActionButton } from "@/components/ui/action-button";
import { Eyebrow } from "@/components/ui/typography";
import { estimateRoadDistanceKm } from "@/domain/fare";
import type { CommuteRoute } from "@/domain/models";
import { formatDistanceKm, formatMinutes, formatPeso } from "./format";
import { describeRouteStatus } from "./provenance";

export function RouteResearchPanel({
  route,
  plan,
  onPlanChange,
}: {
  route: CommuteRoute | null;
  plan: ResearchedCommuteRoutePlan | null;
  onPlanChange: (plan: ResearchedCommuteRoutePlan | null) => void;
}) {
  const [researchingFingerprint, setResearchingFingerprint] = useState<string | null>(null);
  const [fallbackFingerprint, setFallbackFingerprint] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const activeController = useRef<AbortController | null>(null);
  const fingerprint = route ? routeResearchFingerprint(route) : "no-route";
  const isResearching = researchingFingerprint === fingerprint;
  const showDistanceFallback = fallbackFingerprint === fingerprint;

  useEffect(() => {
    requestSequence.current += 1;
    activeController.current?.abort();
    activeController.current = null;
  }, [fingerprint]);

  useEffect(
    () => () => {
      requestSequence.current += 1;
      activeController.current?.abort();
    },
    [],
  );

  if (!route || route.segments.length === 0) return null;

  const visiblePlan = plan?.routeFingerprint === fingerprint ? plan : null;
  const status = describeRouteStatus(route);

  async function requestResearch() {
    if (!route) return;
    activeController.current?.abort();
    const controller = new AbortController();
    activeController.current = controller;
    const sequence = ++requestSequence.current;
    const requestedFingerprint = fingerprint;
    setResearchingFingerprint(requestedFingerprint);
    setFallbackFingerprint(null);

    try {
      const response = await fetch("/api/commute/route-plan", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route }),
      });
      const result = (await response.json()) as CommuteRoutePlanResult;
      if (sequence !== requestSequence.current) {
        return;
      }
      if (!result.success) throw new Error(result.error.message);
      if (result.data.routeFingerprint !== requestedFingerprint) {
        throw new Error("The researched route no longer matches the selected trip.");
      }
      onPlanChange(result.data);
    } catch {
      if (controller.signal.aborted || sequence !== requestSequence.current) return;
      setFallbackFingerprint(requestedFingerprint);
    } finally {
      if (sequence === requestSequence.current) {
        setResearchingFingerprint(null);
        activeController.current = null;
      }
    }
  }

  return (
    <section className="app-panel overflow-hidden print:hidden">
      <div className="border-b border-ink/10 bg-ink p-5 text-paper sm:p-6">
        <Eyebrow tone="mint">AI web route research</Eyebrow>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <h2 className="font-headline text-2xl font-black tracking-[-0.035em]">
              Search how to make this trip, step by step
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-paper/70">
              AI searches current public web sources for services, boarding points, connections,
              and practical arrival steps. Every displayed step must have a clickable citation.
            </p>
          </div>
          <ActionButton
            variant="accent"
            onClick={() => void requestResearch()}
            disabled={isResearching}
          >
            {isResearching ? (
              <>
                <LoaderCircle className="size-3.5 motion-safe:animate-spin" aria-hidden="true" />
                Searching the web…
              </>
            ) : (
              <>
                <Search className="size-3.5" aria-hidden="true" />
                {showDistanceFallback
                  ? "Try web research again"
                  : visiblePlan
                    ? "Research again"
                    : "Research route with AI"}
              </>
            )}
          </ActionButton>
        </div>
        <p className="mt-4 text-[0.68rem] leading-relaxed text-paper/55">
          Opt-in privacy note: this sends the selected place names and coordinates rounded to about
          neighborhood precision to OpenAI for web search. Salary and job-offer figures are never
          included.
        </p>
      </div>

      <div className="p-5 sm:p-6" aria-live="polite">
        {status.kind === "estimated" && !visiblePlan && !isResearching && (
          <DistanceFallback route={route} researchUnavailable={showDistanceFallback} />
        )}

        {isResearching && (
          <div className="flex items-start gap-3 text-sm text-muted">
            <LoaderCircle
              className="mt-0.5 size-4 shrink-0 motion-safe:animate-spin text-flame"
              aria-hidden="true"
            />
            <span>
              Searching public sources and checking that every route step has citation evidence…
            </span>
          </div>
        )}

        {showDistanceFallback && status.kind !== "estimated" && !isResearching && (
          <DistanceFallback route={route} researchUnavailable />
        )}

        {visiblePlan && !isResearching && (
          <div>
            <div className="rounded-[1.1rem] bg-mint/35 p-4 sm:p-5">
              <ResearchedPlanText plan={visiblePlan} />
            </div>

            <div className="mt-5">
              <h3 className="text-[0.68rem] font-black tracking-[0.12em] uppercase">
                Web sources
              </h3>
              <ol className="mt-2 grid gap-2 sm:grid-cols-2">
                {visiblePlan.sources.map((source) => (
                  <li key={source.id}>
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-full items-start gap-2 rounded-[0.8rem] border border-ink/10 bg-paper p-3 text-xs leading-relaxed hover:border-accent"
                    >
                      <span className="numeric font-black text-flame">
                        {source.id.replace("source-", "[") + "]"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block break-words">{source.title}</strong>
                        <span className="mt-0.5 block text-muted">{source.domain}</span>
                      </span>
                      <ExternalLink className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ol>
            </div>

            <p className="mt-4 flex items-start gap-2 rounded-[0.9rem] bg-sand/15 p-3 text-xs leading-relaxed text-muted">
              <ShieldAlert className="mt-0.5 size-4 shrink-0 text-flame" aria-hidden="true" />
              <span>
                {visiblePlan.warning} Researched {formatTimestamp(visiblePlan.researchedAt)}. This
                guidance is separate from the route and fare used in the financial analysis.
              </span>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function DistanceFallback({
  route,
  researchUnavailable,
}: {
  route: CommuteRoute;
  researchUnavailable: boolean;
}) {
  const firstSegment = route.segments[0];
  const lastSegment = route.segments.at(-1);
  if (!firstSegment || !lastSegment) return null;

  const roadDistanceKm = estimateRoadDistanceKm(
    firstSegment.origin.coordinate,
    lastSegment.destination.coordinate,
  );

  return (
    <div className="rounded-[1.1rem] border border-flame/20 bg-sand/15 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <MapPinned className="mt-0.5 size-5 shrink-0 text-flame" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-black">
            {researchUnavailable
              ? "Web directions are unavailable right now."
              : "Distance-based trip estimate"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {researchUnavailable
              ? "Use this estimate to budget for the commute while you check a local operator or map for the actual service."
              : "No provider itinerary matched this corridor, so here is the distance, estimated time, and estimated fare immediately. Web research remains optional."}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 border-t border-ink/10 pt-4 min-[420px]:grid-cols-3">
        <div>
          <dt className="text-[0.62rem] font-black tracking-[0.12em] text-muted uppercase">
            Estimated road distance
          </dt>
          <dd className="numeric mt-1 font-headline text-xl font-black">
            {formatDistanceKm(roadDistanceKm)}
          </dd>
        </div>
        <div>
          <dt className="text-[0.62rem] font-black tracking-[0.12em] text-muted uppercase">
            One-way time
          </dt>
          <dd className="numeric mt-1 font-headline text-xl font-black">
            {formatMinutes(route.oneWayDurationMinutes)}
          </dd>
        </div>
        <div>
          <dt className="text-[0.62rem] font-black tracking-[0.12em] text-muted uppercase">
            One-way fare
          </dt>
          <dd className="numeric mt-1 font-headline text-xl font-black">
            {formatPeso(route.oneWayFare)}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-[0.68rem] leading-relaxed text-muted">
        Distance is calculated from the locations you selected with the same transparent road-distance estimate used for the commute calculation. It is not turn-by-turn directions or a confirmed transport service.
      </p>
    </div>
  );
}

function ResearchedPlanText({ plan }: { plan: ResearchedCommuteRoutePlan }) {
  const sourceById = new Map(plan.sources.map((source) => [source.id, source]));
  const sourceIdsByEnd = new Map<number, string[]>();
  for (const annotation of plan.annotations) {
    const ids = sourceIdsByEnd.get(annotation.endIndex) ?? [];
    if (!ids.includes(annotation.sourceId)) ids.push(annotation.sourceId);
    sourceIdsByEnd.set(annotation.endIndex, ids);
  }

  const positions = [...sourceIdsByEnd.keys()]
    .filter((position) => position > 0 && position <= plan.text.length)
    .sort((left, right) => left - right);
  const content: ReactNode[] = [];
  let cursor = 0;
  for (const position of positions) {
    content.push(plan.text.slice(cursor, position));
    const sourceIds = sourceIdsByEnd.get(position) ?? [];
    content.push(
      <Fragment key={`citations-${position}`}>
        {sourceIds.map((sourceId) => {
          const source = sourceById.get(sourceId);
          if (!source) return null;
          return (
            <a
              key={`${position}-${sourceId}`}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 inline-flex align-super text-[0.65em] font-black text-flame underline decoration-flame/40 underline-offset-2"
              aria-label={`Source: ${source.title}`}
            >
              {sourceId.replace("source-", "[") + "]"}
            </a>
          );
        })}
      </Fragment>,
    );
    cursor = position;
  }
  content.push(plan.text.slice(cursor));

  return <p className="whitespace-pre-wrap text-sm leading-7">{content}</p>;
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}
