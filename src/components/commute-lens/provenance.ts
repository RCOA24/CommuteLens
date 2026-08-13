import { summarizeProvenance } from "@/data/demo";
import type { CommuteRoute } from "@/domain/models";

/**
 * Turns a route's `DataSource[]` into the copy the UI is allowed to show.
 *
 * The five route labels are fixed product copy and must not drift, because
 * they are the app's honesty contract with the user:
 *   - "Live route · estimated fares"          live provider itinerary
 *   - "Scheduled route · estimated fares"     current static timetable
 *   - "Published route pattern"               archival GTFS topology
 *   - "Low-confidence distance estimate"      no itinerary, distance-derived
 *   - "Curated demo route"                    hand-assembled rehearsal data
 *
 * Tone and the plain-language disclosure come from the shared provenance
 * descriptors so this module never invents its own trust vocabulary.
 */

export type RouteStatusKind = "live" | "scheduled" | "archival" | "estimated" | "demo" | "remote";

export interface RouteStatusDescriptor {
  kind: RouteStatusKind;
  /** Short badge text. */
  label: string;
  tone: "neutral" | "informational" | "caution";
  /** One sentence, safe to render verbatim. */
  disclosure: string;
  /** Deduplicated source names for the receipt footer. */
  sourceNames: string[];
  requiresDisclosure: boolean;
}

const REMOTE_DISCLOSURE =
  "No commute was priced because this schedule has no office days. Fares appear only when you add one.";

export function describeRouteStatus(route: CommuteRoute | null): RouteStatusDescriptor {
  if (!route) {
    return {
      kind: "remote",
      label: "Remote · no commute",
      tone: "informational",
      disclosure: REMOTE_DISCLOSURE,
      sourceNames: [],
      requiresDisclosure: false,
    };
  }

  const summary = summarizeProvenance(route.sources);
  const isDemo = route.sources.some((source) => source.type === "demo");
  const isAllEstimated =
    route.sources.length > 0 && route.sources.every((source) => source.type === "estimated");
  const hasArchivalRouting = route.sources.some(
    (source) => source.type === "gtfs" && source.freshness === "archival",
  );
  const hasStaticRouting = route.sources.some(
    (source) => source.type === "gtfs" && source.freshness === "static",
  );

  const kind: RouteStatusKind = isDemo
    ? "demo"
    : isAllEstimated
      ? "estimated"
      : hasArchivalRouting
        ? "archival"
        : hasStaticRouting
          ? "scheduled"
          : "live";
  const label =
    kind === "demo"
      ? "Curated demo route"
      : kind === "estimated"
        ? "Low-confidence distance estimate"
        : kind === "archival"
          ? "Published route pattern · verify service"
          : kind === "scheduled"
            ? "Scheduled route · estimated fares"
            : "Live route · estimated fares";

  return {
    kind,
    label,
    tone: summary?.weakest.tone ?? "caution",
    disclosure:
      summary?.weakest.disclosure ??
      "Fares and travel times are estimates. Actual cost and time will vary.",
    sourceNames: summary?.sourceNames ?? [],
    requiresDisclosure: summary?.requiresDisclosure ?? true,
  };
}

/**
 * A short, non-technical sentence for the route card. It explains what the
 * status means for the decision, not where the bytes came from.
 */
export function routeStatusMeaning(kind: RouteStatusKind): string {
  switch (kind) {
    case "live":
      return "Timings come from a live transit itinerary. Fares are estimated from typical Metro Manila bands.";
    case "scheduled":
      return "Timings come from a published static timetable and may not reflect delays, cancellations, or service changes.";
    case "archival":
      return "Stops and connections come from an archived DOTC/Sakay route pattern. Timing and fare are estimates; confirm that the service still operates.";
    case "estimated":
      return "No itinerary matched this corridor, so travel time and fare were estimated from distance. Treat them as a rough floor.";
    case "demo":
      return "This corridor uses the curated rehearsal dataset, so the numbers are stable but not live.";
    case "remote":
      return REMOTE_DISCLOSURE;
  }
}

/** Reliability is provider-reported; surface it as words, never as colour alone. */
export function reliabilityLabel(reliability: CommuteRoute["reliability"]): string {
  switch (reliability) {
    case "high":
      return "High confidence";
    case "medium":
      return "Medium confidence";
    default:
      return "Low confidence";
  }
}
