import { sanitizeFreeText } from "@/application/explain-analysis/facts";
import type { CommuteRoute, TransportMode } from "@/domain/models";

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

export type CommuteGuideDegradedReason =
  | "not-configured"
  | "timeout"
  | "upstream"
  | "malformed"
  | "guardrail"
  | "no-verified-itinerary";

export class CommuteGuideProviderError extends Error {
  constructor(
    message: string,
    readonly reason: Exclude<CommuteGuideDegradedReason, "no-verified-itinerary" | "guardrail">,
  ) {
    super(message);
    this.name = "CommuteGuideProviderError";
  }
}

export interface CommuteGuideFacts {
  origin: string;
  destination: string;
  transfers: number;
  totalDurationMinutes: number;
  totalFare: number;
  steps: Array<{
    mode: TransportMode;
    origin: string;
    destination: string;
    estimatedDurationMinutes: number;
    estimatedFare: number;
  }>;
}

export interface CommuteRouteOptionFacts {
  option: number;
  totalDurationMinutes: number;
  totalFare: number;
  transfers: number;
  modes: TransportMode[];
}

export interface CommuteGuideProvider {
  get isConfigured(): boolean;
  guide(facts: CommuteGuideFacts, signal?: AbortSignal): Promise<string>;
}

export interface CommuteRecommendationProvider {
  get isConfigured(): boolean;
  recommend(
    options: CommuteRouteOptionFacts[],
    signal?: AbortSignal,
  ): Promise<{ option: number; rationale: string }>;
}

export interface CommuteGuide {
  text: string;
  source: "ai" | "deterministic" | "unavailable";
  degradedReason?: CommuteGuideDegradedReason;
}

export interface CommuteRouteRecommendation {
  option: number | null;
  text: string;
  source: "ai" | "deterministic" | "unavailable";
  degradedReason?: CommuteGuideDegradedReason;
}

export interface CommuteGuideEligibility {
  isEligible: boolean;
  message: string;
}

const NO_VERIFIED_ITINERARY_MESSAGE =
  "No provider itinerary is available for this trip. This is a low-confidence distance estimate, so Commute Lens cannot recommend a transport mode, service, or path. Check a local operator or map before relying on it.";

/**
 * A route is guideable only when routing—not merely fare pricing—came from an
 * official or GTFS-backed itinerary. The distance fallback deliberately has
 * neither and must never be made to sound like a real route by AI prose.
 */
export function getCommuteGuideEligibility(route: CommuteRoute): CommuteGuideEligibility {
  const hasProviderItinerary = route.sources.some(
    (source) => source.type === "gtfs" || source.type === "official",
  );
  return hasProviderItinerary
    ? {
        isEligible: true,
        message:
          "This provider itinerary can be explained using its listed legs, times, fares, and transfers.",
      }
    : { isEligible: false, message: NO_VERIFIED_ITINERARY_MESSAGE };
}

function modePhrase(mode: TransportMode): string {
  if (mode === "walk") return "Walk";
  if (mode === "uv-express") return "Take a UV Express";
  if (mode === "p2p") return "Take a P2P bus";
  if (mode === "rail") return "Take the train";
  if (mode === "other") return "Use the listed transport";
  return `Take a ${mode}`;
}

export function buildCommuteGuideFacts(route: CommuteRoute): CommuteGuideFacts {
  const first = route.segments[0];
  const last = route.segments.at(-1);

  return {
    origin: sanitizeFreeText(first?.origin.label ?? "your starting point"),
    destination: sanitizeFreeText(last?.destination.label ?? "your destination"),
    transfers: route.transfers,
    totalDurationMinutes: Math.round(route.oneWayDurationMinutes),
    totalFare: Math.round(route.oneWayFare),
    steps: route.segments.map((segment) => ({
      mode: segment.mode,
      origin: sanitizeFreeText(segment.origin.label),
      destination: sanitizeFreeText(segment.destination.label),
      estimatedDurationMinutes: Math.round(segment.estimatedDurationMinutes),
      estimatedFare: Math.round(segment.estimatedFare),
    })),
  };
}

export function buildCommuteRouteOptionFacts(routes: readonly CommuteRoute[]): CommuteRouteOptionFacts[] {
  return routes.map((route, index) => ({
    option: index + 1,
    totalDurationMinutes: Math.round(route.oneWayDurationMinutes),
    totalFare: Math.round(route.oneWayFare),
    transfers: route.transfers,
    modes: route.segments.map((segment) => segment.mode),
  }));
}

export function buildDeterministicCommuteGuide(facts: CommuteGuideFacts): string {
  const instructions = facts.steps.map((step, index) => {
    const fare = step.estimatedFare > 0 ? `, estimated fare ${peso.format(step.estimatedFare)}` : "";
    return `Step ${index + 1}: ${modePhrase(step.mode)} from ${step.origin} to ${step.destination}, about ${step.estimatedDurationMinutes} minutes${fare}.`;
  });

  const transferNote =
    facts.transfers === 0
      ? "No transit transfers were counted, although walking to or from a stop may still be needed."
      : `${facts.transfers} transit transfer${facts.transfers === 1 ? " is" : "s are"} counted in this itinerary.`;

  return [
    `Start at ${facts.origin}.`,
    ...instructions,
    `Your destination is ${facts.destination}.`,
    transferNote,
  ].join(" ");
}

function extractNumbers(value: string): number[] {
  return (value.match(/\d[\d,]*(?:\.\d+)?/g) ?? [])
    .map((token) => Number.parseFloat(token.replace(/,/g, "")))
    .filter(Number.isFinite);
}

function permittedNumbers(facts: CommuteGuideFacts): number[] {
  return [
    facts.transfers,
    facts.totalDurationMinutes,
    facts.totalFare,
    ...extractNumbers(facts.origin),
    ...extractNumbers(facts.destination),
    ...facts.steps.flatMap((step) => [
      step.estimatedDurationMinutes,
      step.estimatedFare,
      ...extractNumbers(step.origin),
      ...extractNumbers(step.destination),
    ]),
  ];
}

function hasOnlyPermittedNumbers(text: string, facts: CommuteGuideFacts): boolean {
  const permitted = permittedNumbers(facts);
  const withoutStepNumbers = text.replace(/\bstep\s+\d{1,2}\b/gi, "step");
  return extractNumbers(withoutStepNumbers).every((value) =>
    permitted.some((item) => Math.abs(item - value) <= 0.51),
  );
}

function passesGuideGuardrails(text: string, facts: CommuteGuideFacts): boolean {
  const unsupportedClaim =
    /\b(?:platform\s+[a-z0-9-]+|depart(?:ure)?\s+at|arrive\s+at\s+\d|traffic\s+is|road\s+closure|guaranteed|safest|head\s+straight|direct\s+route)\b/i;
  const trimmed = text.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= 1_200 &&
    !unsupportedClaim.test(trimmed) &&
    hasOnlyPermittedNumbers(trimmed, facts)
  );
}

function recommendedOption(options: CommuteRouteOptionFacts[]): CommuteRouteOptionFacts {
  return [...options].sort(
    (left, right) =>
      left.totalDurationMinutes - right.totalDurationMinutes ||
      left.transfers - right.transfers ||
      left.totalFare - right.totalFare ||
      left.option - right.option,
  )[0]!;
}

function deterministicRecommendation(options: CommuteRouteOptionFacts[]): CommuteRouteRecommendation {
  const selected = recommendedOption(options);
  return {
    option: selected.option,
    source: "deterministic",
    text: `Option ${selected.option} is the fallback recommendation because it ranks first by listed duration, then transit transfers, then estimated fare. Review the route details before relying on it.`,
  };
}

function passesRecommendationGuardrails(
  recommendation: { option: number; rationale: string },
  options: CommuteRouteOptionFacts[],
): boolean {
  const unsupportedClaim =
    /\b(?:platform|schedule|depart(?:ure)?|arriv(?:e|al)|traffic|road|safest|guaranteed|accessible|live\s+status|direct\s+route|head\s+straight)\b/i;
  const rationale = recommendation.rationale.trim();
  return (
    options.some((option) => option.option === recommendation.option) &&
    rationale.length > 0 &&
    rationale.length <= 360 &&
    !unsupportedClaim.test(rationale) &&
    extractNumbers(rationale).length === 0
  );
}

export async function guideCommute(
  route: CommuteRoute,
  provider: CommuteGuideProvider | null,
  signal?: AbortSignal,
): Promise<CommuteGuide> {
  const eligibility = getCommuteGuideEligibility(route);
  if (!eligibility.isEligible) {
    return {
      text: eligibility.message,
      source: "unavailable",
      degradedReason: "no-verified-itinerary",
    };
  }

  const facts = buildCommuteGuideFacts(route);
  const deterministic = buildDeterministicCommuteGuide(facts);

  if (!provider) {
    return { text: deterministic, source: "deterministic", degradedReason: "not-configured" };
  }

  try {
    const generated = await provider.guide(facts, signal);
    if (!passesGuideGuardrails(generated, facts)) {
      return { text: deterministic, source: "deterministic", degradedReason: "guardrail" };
    }
    return { text: generated, source: "ai" };
  } catch (error) {
    const reason = error instanceof CommuteGuideProviderError ? error.reason : "upstream";
    return { text: deterministic, source: "deterministic", degradedReason: reason };
  }
}

export async function recommendCommuteRoute(
  routes: readonly CommuteRoute[],
  provider: CommuteRecommendationProvider | null,
  signal?: AbortSignal,
): Promise<CommuteRouteRecommendation> {
  const eligibleRoutes = routes.filter((route) => getCommuteGuideEligibility(route).isEligible);
  if (eligibleRoutes.length === 0) {
    return {
      option: null,
      text: NO_VERIFIED_ITINERARY_MESSAGE,
      source: "unavailable",
      degradedReason: "no-verified-itinerary",
    };
  }

  const options = buildCommuteRouteOptionFacts(eligibleRoutes);
  if (options.length === 1) {
    return {
      option: 1,
      text: "Only one provider itinerary is available. Review its listed legs before relying on it.",
      source: "deterministic",
    };
  }

  if (!provider) {
    return { ...deterministicRecommendation(options), degradedReason: "not-configured" };
  }

  try {
    const generated = await provider.recommend(options, signal);
    if (!passesRecommendationGuardrails(generated, options)) {
      return { ...deterministicRecommendation(options), degradedReason: "guardrail" };
    }
    return {
      option: generated.option,
      text: `AI recommends option ${generated.option}: ${generated.rationale.trim()}`,
      source: "ai",
    };
  } catch (error) {
    const reason = error instanceof CommuteGuideProviderError ? error.reason : "upstream";
    return { ...deterministicRecommendation(options), degradedReason: reason };
  }
}
