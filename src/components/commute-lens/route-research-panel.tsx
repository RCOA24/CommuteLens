"use client";

import { ExternalLink, LoaderCircle, MapPinned, Search, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
    <section className="app-panel ai-module overflow-hidden print:hidden">
      <div className="border-b border-ink/10 bg-ink p-5 text-paper sm:p-6">
        <span className="ai-badge">
          <Search className="size-3" aria-hidden="true" /> Optional AI · cited web search
        </span>
        <Eyebrow className="mt-3" tone="mint">
          Route research
        </Eyebrow>
        <div className="mt-2 flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 max-w-2xl">
            <h2 className="font-headline text-2xl font-black tracking-[-0.035em]">
              Search how to make this trip, step by step
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-paper/70">
              AI searches current public web sources for services, boarding points, connections, and
              practical arrival steps. Every displayed step must have a clickable citation.
            </p>
          </div>
          <ActionButton
            className="w-full shrink-0 sm:w-auto"
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
            <span className="min-w-0">
              Searching public sources and checking that every route step has citation evidence…
            </span>
          </div>
        )}

        {showDistanceFallback && status.kind !== "estimated" && !isResearching && (
          <DistanceFallback route={route} researchUnavailable />
        )}

        {visiblePlan && !isResearching && (
          <div>
            <ResearchedPlanText plan={visiblePlan} />

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
        Distance is calculated from the locations you selected with the same transparent
        road-distance estimate used for the commute calculation. It is not turn-by-turn directions
        or a confirmed transport service.
      </p>
    </div>
  );
}

interface ParsedResearchStep {
  number: number;
  text: string;
  start: number;
  end: number;
  sourceIds: string[];
}

function parseResearchedPlan(plan: ResearchedCommuteRoutePlan): {
  overview: string;
  steps: ParsedResearchStep[];
  verificationItems: string[];
} {
  const overviewParts: string[] = [];
  const verificationItems: string[] = [];
  const steps: ParsedResearchStep[] = [];
  let section: "overview" | "steps" | "verification" | null = null;
  let activeStep: ParsedResearchStep | null = null;

  for (const match of plan.text.matchAll(/^.*$/gm)) {
    const rawLine = match[0];
    const line = rawLine.trim();
    const lineStart = match.index ?? 0;
    if (!line) continue;

    const overviewHeading = /^ROUTE OVERVIEW\b\s*[:—-]?\s*(.*)$/i.exec(line);
    if (overviewHeading) {
      section = "overview";
      activeStep = null;
      if (overviewHeading[1]) overviewParts.push(overviewHeading[1]);
      continue;
    }

    const verificationHeading = /^VERIFY BEFORE TRAVEL\b\s*[:—-]?\s*(.*)$/i.exec(line);
    if (verificationHeading) {
      section = "verification";
      activeStep = null;
      if (verificationHeading[1]) verificationItems.push(verificationHeading[1]);
      continue;
    }

    const numberedStep = /^(\d{1,2})\.\s+(.*)$/.exec(line);
    if (numberedStep) {
      section = "steps";
      activeStep = {
        number: Number(numberedStep[1]),
        text: numberedStep[2] ?? "",
        start: lineStart,
        end: lineStart + rawLine.length,
        sourceIds: [],
      };
      steps.push(activeStep);
      continue;
    }

    if (section === "overview") overviewParts.push(line);
    else if (section === "verification") {
      verificationItems.push(line.replace(/^[-*•]\s*/, ""));
    } else if (section === "steps" && activeStep) {
      activeStep.text = `${activeStep.text} ${line}`.trim();
      activeStep.end = lineStart + rawLine.length;
    }
  }

  for (const step of steps) {
    step.sourceIds = [
      ...new Set(
        plan.annotations
          .filter(
            (annotation) => annotation.startIndex < step.end && annotation.endIndex > step.start,
          )
          .map((annotation) => annotation.sourceId),
      ),
    ];
  }

  return {
    overview: overviewParts.join(" ").trim(),
    steps,
    verificationItems,
  };
}

function ResearchedPlanText({ plan }: { plan: ResearchedCommuteRoutePlan }) {
  const parsed = parseResearchedPlan(plan);
  const sourceById = new Map(plan.sources.map((source) => [source.id, source]));

  return (
    <div className="grid gap-4">
      <section
        className="rounded-[1.1rem] bg-mint/45 p-4 sm:p-5"
        aria-labelledby="route-overview-heading"
      >
        <div className="flex items-start gap-3">
          <MapPinned className="mt-0.5 size-5 shrink-0 text-flame" aria-hidden="true" />
          <div className="min-w-0">
            <h3
              id="route-overview-heading"
              className="text-[0.65rem] font-black tracking-[0.13em] text-leaf uppercase"
            >
              Route overview
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed font-bold">
              {parsed.overview || "A cited route overview was not available."}
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="researched-steps-heading">
        <h3
          id="researched-steps-heading"
          className="text-[0.68rem] font-black tracking-[0.12em] uppercase"
        >
          Cited route steps
        </h3>
        <ol className="mt-2 grid gap-2.5">
          {parsed.steps.map((step) => (
            <li
              key={step.number}
              className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 rounded-[0.95rem] border border-ink/10 bg-paper p-3.5 sm:p-4"
            >
              <span
                className="numeric grid size-8 place-items-center rounded-full bg-ink text-xs font-black text-paper"
                aria-hidden="true"
              >
                {step.number}
              </span>
              <div className="min-w-0">
                <p className="break-words text-sm leading-relaxed">{step.text}</p>
                <div
                  className="mt-2.5 flex flex-wrap gap-1.5"
                  aria-label={`Sources for step ${step.number}`}
                >
                  {step.sourceIds.map((sourceId) => {
                    const source = sourceById.get(sourceId);
                    if (!source) return null;
                    return (
                      <a
                        key={sourceId}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={source.title}
                        className="inline-flex min-w-0 items-center gap-1 rounded-full border border-flame/20 bg-flame/8 px-2 py-1 text-[0.62rem] font-black text-flame hover:border-flame"
                        aria-label={`Source ${sourceId.replace("source-", "")}: ${source.title}`}
                      >
                        <span className="numeric">[{sourceId.replace("source-", "")}]</span>
                        <span className="max-w-36 truncate text-ink/70">{source.domain}</span>
                        <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
                      </a>
                    );
                  })}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        className="rounded-[1rem] border border-ink/10 bg-sand/12 p-4"
        aria-labelledby="verify-travel-heading"
      >
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-flame" aria-hidden="true" />
          <div className="min-w-0">
            <h3
              id="verify-travel-heading"
              className="text-[0.65rem] font-black tracking-[0.12em] uppercase"
            >
              Verify before travel
            </h3>
            <ul className="mt-2 grid gap-1.5 text-xs leading-relaxed text-muted">
              {(parsed.verificationItems.length > 0
                ? parsed.verificationItems
                : ["Confirm current service details with the cited operators before travelling."]
              ).map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span
                    className="mt-[0.42rem] size-1.5 shrink-0 rounded-full bg-flame"
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}
