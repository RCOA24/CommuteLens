import { sanitizeFreeText } from "@/application/explain-analysis/facts";
import type { CommuteRoute } from "@/domain/models";

export type RouteResearchFailureReason =
  "not-configured" | "timeout" | "upstream" | "malformed" | "guardrail";

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

interface TextEdit {
  start: number;
  end: number;
  replacement: string;
}

function applyTextEdits(
  result: RouteResearchProviderResult,
  edits: readonly TextEdit[],
): RouteResearchProviderResult {
  const ordered = [...edits]
    .filter((edit) => edit.start >= 0 && edit.end > edit.start && edit.end <= result.text.length)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const accepted: TextEdit[] = [];
  for (const edit of ordered) {
    if (accepted.length === 0 || edit.start >= accepted[accepted.length - 1]!.end) {
      accepted.push(edit);
    }
  }
  if (accepted.length === 0) return result;

  let cursor = 0;
  let text = "";
  for (const edit of accepted) {
    text += result.text.slice(cursor, edit.start) + edit.replacement;
    cursor = edit.end;
  }
  text += result.text.slice(cursor);

  function remapBoundary(index: number, affinity: "start" | "end"): number {
    let delta = 0;
    for (const edit of accepted) {
      if (index <= edit.start) return index + delta;
      if (index >= edit.end) {
        delta += edit.replacement.length - (edit.end - edit.start);
        continue;
      }
      return edit.start + delta + (affinity === "end" ? edit.replacement.length : 0);
    }
    return index + delta;
  }

  return {
    ...result,
    text,
    annotations: result.annotations.map((annotation) => ({
      ...annotation,
      startIndex: remapBoundary(annotation.startIndex, "start"),
      endIndex: remapBoundary(annotation.endIndex, "end"),
    })),
  };
}

function replaceMatches(
  result: RouteResearchProviderResult,
  pattern: RegExp,
  replacement: (match: RegExpMatchArray) => string,
): RouteResearchProviderResult {
  const edits = [...result.text.matchAll(pattern)].flatMap((match) =>
    match.index === undefined
      ? []
      : [
          {
            start: match.index,
            end: match.index + match[0].length,
            replacement: replacement(match),
          },
        ],
  );
  return applyTextEdits(result, edits);
}

/** Removes model-printed links while keeping provider citation offsets aligned to the cleaned text. */
function normalizeProviderResult(
  providerResult: RouteResearchProviderResult,
): RouteResearchProviderResult {
  let result = replaceMatches(providerResult, /\r\n?/g, () => "\n");
  result = replaceMatches(
    result,
    /^(?:#{1,6}\s*)?(?:web\s+)?(?:sources?|references?)\s*:?\s*$[\s\S]*/gim,
    () => "",
  );
  result = replaceMatches(
    result,
    /\[([^\]\n]{1,240})\]\((https?:\/\/[^)\s]+)\)/gi,
    (match) => match[1] ?? "",
  );
  result = replaceMatches(result, /<https?:\/\/[^>\s]+>/gi, () => "");
  result = replaceMatches(result, /https?:\/\/[^\s<>\]]+/gi, (match) => {
    const trailingPunctuation = match[0].match(/[),.;!?]+$/)?.[0] ?? "";
    return trailingPunctuation;
  });
  result = replaceMatches(result, /[ \t]*\[(?:\d{1,2}(?:\s*[,;-]\s*\d{1,2})*)\]/g, () => "");
  result = replaceMatches(result, /^#{1,6}[ \t]+/gm, () => "");
  result = replaceMatches(result, /\*\*|__/g, () => "");
  result = replaceMatches(result, /\(\s*\)/g, () => "");
  result = replaceMatches(result, /[ \t]+(?=[,.;:!?])/g, () => "");
  result = replaceMatches(result, /[ \t]{2,}/g, () => " ");
  result = replaceMatches(result, /^[ \t]+|[ \t]+$/gm, () => "");
  result = replaceMatches(result, /\n{3,}/g, () => "\n\n");
  result = replaceMatches(result, /^\s+|\s+$/g, () => "");
  return result;
}

function numberedStepRanges(text: string): Array<{ number: number; start: number; end: number }> {
  const matches = [...text.matchAll(/^(\d{1,2})\.\s+/gm)];
  const verifyStart = /^VERIFY BEFORE TRAVEL\b/im.exec(text)?.index ?? text.length;
  return matches.map((match, index) => {
    const start = match.index ?? 0;
    const nextStart = matches[index + 1]?.index ?? text.length;
    let end = Math.min(nextStart, verifyStart > start ? verifyStart : text.length);
    while (end > start && /\s/.test(text[end - 1] ?? "")) end -= 1;
    return { number: Number(match[1]), start, end };
  });
}

function safeSourceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function validateProviderResult(
  providerResult: RouteResearchProviderResult,
): RouteResearchProviderResult {
  const result = normalizeProviderResult(providerResult);
  const text = result.text;
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  if (!text.trim() || text.length > 6_000 || wordCount > 500) {
    throw new RouteResearchError("AI route research returned unsupported text.", "malformed");
  }
  if (/https?:\/\//i.test(text) || /\[[^\]\n]+\]\([^)\n]+\)/.test(text)) {
    throw new RouteResearchError("AI route research returned visible links.", "guardrail");
  }
  if (/\b(?:guaranteed safe|safest route|definitely safe|risk-free)\b/i.test(text)) {
    throw new RouteResearchError(
      "AI route research made an unsupported safety claim.",
      "guardrail",
    );
  }
  const overviewStart = /^ROUTE OVERVIEW\b/im.exec(text)?.index;
  const verifyStart = /^VERIFY BEFORE TRAVEL\b/im.exec(text)?.index;
  if (overviewStart === undefined || verifyStart === undefined || overviewStart >= verifyStart) {
    throw new RouteResearchError(
      "AI route research returned an unsupported structure.",
      "guardrail",
    );
  }

  const uniqueSourceIds = new Set<string>();
  const usableSources = result.sources.filter((source) => {
    if (
      uniqueSourceIds.has(source.id) ||
      !source.id.trim() ||
      !source.title.trim() ||
      !safeSourceUrl(source.url)
    ) {
      return false;
    }
    uniqueSourceIds.add(source.id);
    return true;
  });
  if (usableSources.length === 0 || usableSources.length > 12) {
    throw new RouteResearchError("AI route research did not provide usable sources.", "guardrail");
  }

  const sourceIds = new Set(usableSources.map((source) => source.id));
  const validAnnotations = result.annotations.filter(
    (annotation) =>
      sourceIds.has(annotation.sourceId) &&
      annotation.startIndex >= 0 &&
      annotation.endIndex > annotation.startIndex &&
      annotation.endIndex <= text.length,
  );
  if (validAnnotations.length === 0 || validAnnotations.length > 30) {
    throw new RouteResearchError(
      "AI route research did not provide usable citations.",
      "guardrail",
    );
  }

  const steps = numberedStepRanges(text);
  const sequential = steps.every((step, index) => step.number === index + 1);
  const everyStepCited = steps.every((step) =>
    validAnnotations.some(
      (annotation) => annotation.startIndex < step.end && annotation.endIndex > step.start,
    ),
  );
  if (steps.length < 3 || steps.length > 7 || !sequential || !everyStepCited) {
    throw new RouteResearchError(
      "AI route research did not return a fully cited step-by-step plan.",
      "guardrail",
    );
  }

  const referencedSourceIds = new Set(validAnnotations.map((annotation) => annotation.sourceId));
  const referencedSources = usableSources.filter((source) => referencedSourceIds.has(source.id));
  const renamedSourceIds = new Map(
    referencedSources.map((source, index) => [source.id, `source-${index + 1}`]),
  );
  const annotations = validAnnotations
    .map((annotation) => ({
      ...annotation,
      sourceId: renamedSourceIds.get(annotation.sourceId) ?? annotation.sourceId,
    }))
    .filter(
      (annotation, index, all) =>
        all.findIndex(
          (candidate) =>
            candidate.sourceId === annotation.sourceId &&
            candidate.startIndex === annotation.startIndex &&
            candidate.endIndex === annotation.endIndex,
        ) === index,
    );

  return {
    ...result,
    sources: referencedSources.map((source) => ({
      ...source,
      id: renamedSourceIds.get(source.id) ?? source.id,
    })),
    annotations,
  };
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
