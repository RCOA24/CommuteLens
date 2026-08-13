import { sanitizeFreeText } from "@/application/explain-analysis/facts";
import type { CommuteRoute } from "@/domain/models";

export type RouteResearchFailureReason =
  | "not-configured"
  | "timeout"
  | "upstream"
  | "malformed"
  | "guardrail";

export class RouteResearchError extends Error {
  constructor(
    message: string,
    readonly reason: RouteResearchFailureReason,
  ) {
    super(message);
    this.name = "RouteResearchError";
  }
}

export interface RouteResearchFacts {
  origin: {
    label: string;
    approximateLatitude: number;
    approximateLongitude: number;
  };
  destination: {
    label: string;
    approximateLatitude: number;
    approximateLongitude: number;
  };
  pricedRouteContext: {
    kind: "provider-itinerary" | "distance-estimate" | "curated-demo";
    steps: Array<{
      mode: string;
      origin: string;
      destination: string;
    }>;
  };
}

export interface RouteResearchSource {
  id: string;
  title: string;
  url: string;
  domain: string;
}

export interface RouteResearchAnnotation {
  sourceId: string;
  startIndex: number;
  endIndex: number;
}

export interface RouteResearchProviderResult {
  text: string;
  sources: RouteResearchSource[];
  annotations: RouteResearchAnnotation[];
}

export interface RouteResearchProvider {
  get isConfigured(): boolean;
  research(facts: RouteResearchFacts, signal?: AbortSignal): Promise<RouteResearchProviderResult>;
}

export interface ResearchedCommuteRoutePlan extends RouteResearchProviderResult {
  routeFingerprint: string;
  researchedAt: string;
  source: "ai-web-search";
  warning: string;
}

const PLAN_WARNING =
  "Web sources can be incomplete or outdated. Confirm the service, boarding point, fare, and operating hours with the cited operator or an official journey planner before travelling.";

function roundCoordinate(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function routeContextKind(route: CommuteRoute): RouteResearchFacts["pricedRouteContext"]["kind"] {
  if (route.sources.some((source) => source.type === "demo")) return "curated-demo";
  if (route.sources.every((source) => source.type === "estimated")) return "distance-estimate";
  return "provider-itinerary";
}

export function buildRouteResearchFacts(route: CommuteRoute): RouteResearchFacts {
  const first = route.segments[0];
  const last = route.segments.at(-1);
  if (!first || !last) {
    throw new RouteResearchError("The route has no usable endpoints.", "malformed");
  }

  return {
    origin: {
      label: sanitizeFreeText(first.origin.label),
      approximateLatitude: roundCoordinate(first.origin.coordinate.latitude),
      approximateLongitude: roundCoordinate(first.origin.coordinate.longitude),
    },
    destination: {
      label: sanitizeFreeText(last.destination.label),
      approximateLatitude: roundCoordinate(last.destination.coordinate.latitude),
      approximateLongitude: roundCoordinate(last.destination.coordinate.longitude),
    },
    pricedRouteContext: {
      kind: routeContextKind(route),
      steps: route.segments.slice(0, 12).map((segment) => ({
        mode: segment.mode,
        origin: sanitizeFreeText(segment.origin.label),
        destination: sanitizeFreeText(segment.destination.label),
      })),
    },
  };
}

/** A stable session key; it is a stale-response guard, not an authenticity token. */
export function routeResearchFingerprint(route: CommuteRoute): string {
  const serialized = JSON.stringify({
    id: route.id,
    fare: route.oneWayFare,
    minutes: route.oneWayDurationMinutes,
    segments: route.segments.map((segment) => [
      segment.mode,
      segment.origin.label,
      segment.origin.coordinate.latitude,
      segment.origin.coordinate.longitude,
      segment.destination.label,
      segment.destination.coordinate.latitude,
      segment.destination.coordinate.longitude,
    ]),
  });
  let hash = 2_166_136_261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `route-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function numberedStepRanges(text: string): Array<{ number: number; start: number; end: number }> {
  const ranges: Array<{ number: number; start: number; end: number }> = [];
  const pattern = /^(\d{1,2})\.\s+\S.*$/gm;
  for (const match of text.matchAll(pattern)) {
    const start = match.index;
    const matchedText = match[0];
    if (start === undefined) continue;
    ranges.push({ number: Number(match[1]), start, end: start + matchedText.length });
  }
  return ranges;
}

function validateProviderResult(result: RouteResearchProviderResult): RouteResearchProviderResult {
  const text = result.text;
  if (!text.trim() || text.length > 6_000) {
    throw new RouteResearchError("AI route research returned unsupported text.", "malformed");
  }
  if (/\b(?:guaranteed safe|safest route|definitely safe|risk-free)\b/i.test(text)) {
    throw new RouteResearchError("AI route research made an unsupported safety claim.", "guardrail");
  }
  if (result.sources.length === 0 || result.sources.length > 12) {
    throw new RouteResearchError("AI route research did not provide usable sources.", "guardrail");
  }

  const sourceIds = new Set(result.sources.map((source) => source.id));
  const validAnnotations = result.annotations.filter(
    (annotation) =>
      sourceIds.has(annotation.sourceId) &&
      annotation.startIndex >= 0 &&
      annotation.endIndex > annotation.startIndex &&
      annotation.endIndex <= text.length,
  );
  if (validAnnotations.length === 0 || validAnnotations.length > 30) {
    throw new RouteResearchError("AI route research did not provide usable citations.", "guardrail");
  }

  const steps = numberedStepRanges(text);
  const sequential = steps.every((step, index) => step.number === index + 1);
  const everyStepCited = steps.every((step) =>
    validAnnotations.some(
      (annotation) => annotation.startIndex < step.end && annotation.endIndex > step.start,
    ),
  );
  if (steps.length < 2 || steps.length > 10 || !sequential || !everyStepCited) {
    throw new RouteResearchError(
      "AI route research did not return a fully cited step-by-step plan.",
      "guardrail",
    );
  }

  return { ...result, annotations: validAnnotations };
}

export async function researchCommuteRoute(
  route: CommuteRoute,
  provider: RouteResearchProvider | null,
  signal?: AbortSignal,
): Promise<ResearchedCommuteRoutePlan> {
  if (!provider?.isConfigured) {
    throw new RouteResearchError("AI route research is not configured.", "not-configured");
  }

  const result = validateProviderResult(
    await provider.research(buildRouteResearchFacts(route), signal),
  );
  return {
    ...result,
    routeFingerprint: routeResearchFingerprint(route),
    researchedAt: new Date().toISOString(),
    source: "ai-web-search",
    warning: PLAN_WARNING,
  };
}
