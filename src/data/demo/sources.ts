import type { DataSource, DataSourceType } from "@/domain/models";

/**
 * CL-005 / CL-014 — provenance definitions for the curated demo dataset.
 *
 * Every curated value in this folder is hand-assembled for the CUTC demo. It is
 * never presented as live, official, or verified transit data. Member 2 renders
 * the descriptors below; Member 3 owns the values.
 */

const CURATED_EFFECTIVE_DATE = "2026-01-05";

/** Curated route shapes, interchange choices, and travel-time bands. */
export const DEMO_SOURCE: DataSource = {
  type: "demo",
  name: "Commute Lens curated CUTC scenario",
  effectiveDate: CURATED_EFFECTIVE_DATE,
  confidence: "medium",
};

/**
 * Fares/durations approximated from published Metro Manila fare matrices but
 * not re-verified against an operator feed. Lower confidence than `DEMO_SOURCE`
 * on purpose so the UI can distinguish the two.
 */
export const ESTIMATED_SOURCE: DataSource = {
  type: "estimated",
  name: "Commute Lens estimated Metro Manila fare band",
  effectiveDate: CURATED_EFFECTIVE_DATE,
  confidence: "low",
};

export interface ProvenanceDescriptor {
  type: DataSourceType;
  /** Short chip/badge text. */
  shortLabel: string;
  /** Full label for legends and the receipt footer. */
  label: string;
  /** How prominently the UI should warn. */
  tone: "neutral" | "informational" | "caution";
  /** One-sentence disclosure. Safe to render verbatim. */
  disclosure: string;
}

export const PROVENANCE_DESCRIPTORS: Readonly<Record<DataSourceType, ProvenanceDescriptor>> =
  Object.freeze({
    official: {
      type: "official",
      shortLabel: "Official",
      label: "Official operator data",
      tone: "neutral",
      disclosure: "Published by the transport operator or regulator.",
    },
    gtfs: {
      type: "gtfs",
      shortLabel: "Open data",
      label: "GTFS / open transit feed",
      tone: "neutral",
      disclosure: "Derived from an open transit feed and may lag real-world service.",
    },
    crowdsourced: {
      type: "crowdsourced",
      shortLabel: "Crowdsourced",
      label: "Crowdsourced commuter reports",
      tone: "informational",
      disclosure: "Reported by commuters and not independently verified.",
    },
    estimated: {
      type: "estimated",
      shortLabel: "Estimated",
      label: "Estimated fare and travel time",
      tone: "caution",
      disclosure: "Estimated from typical fare bands. Actual cost and time will vary.",
    },
    demo: {
      type: "demo",
      shortLabel: "Demo",
      label: "Curated demo data",
      tone: "caution",
      disclosure:
        "Curated demo data for this prototype. Not live, official, or verified transit information.",
    },
  });

export interface ProvenanceSummary {
  /** Distinct descriptors present, ordered from least to most authoritative. */
  descriptors: ProvenanceDescriptor[];
  /** The weakest source present — drives the headline badge. */
  weakest: ProvenanceDescriptor;
  /** True when any value shown to the user is demo or estimated. */
  requiresDisclosure: boolean;
  /** Deduplicated source names, for the receipt footer. */
  sourceNames: string[];
}

/** Least → most authoritative. The weakest link determines how we label a route. */
const AUTHORITY_ORDER: readonly DataSourceType[] = [
  "demo",
  "estimated",
  "crowdsourced",
  "gtfs",
  "official",
];

/**
 * CL-014 — turns raw `DataSource[]` into render-ready provenance metadata.
 * Presentation-only: it never inspects or alters fares, durations, or scores.
 */
export function summarizeProvenance(sources: readonly DataSource[]): ProvenanceSummary | null {
  if (sources.length === 0) return null;

  const presentTypes = new Set(sources.map((source) => source.type));
  const descriptors = AUTHORITY_ORDER.filter((type) => presentTypes.has(type)).map(
    (type) => PROVENANCE_DESCRIPTORS[type],
  );
  const weakest = descriptors[0];

  return {
    descriptors,
    weakest,
    requiresDisclosure: presentTypes.has("demo") || presentTypes.has("estimated"),
    sourceNames: [...new Set(sources.map((source) => source.name))],
  };
}
