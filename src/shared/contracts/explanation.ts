import type {
  CommuteRoute,
  FareDiscountClassName,
  JobOffer,
  JobRealityAnalysis,
  JobRealityComparison,
  Location,
} from "@/domain/models";

/**
 * The only client-to-server payload accepted by /api/explain.
 *
 * These are inputs that the server recalculates, never the analysis result.
 * Fare entitlement is explicit so an already-priced preview route cannot be
 * accidentally reinterpreted as a regular-fare route.
 */
export interface ExplainAnalysisRequest {
  kind: "analysis";
  origin: Location;
  route: CommuteRoute | null;
  discountClass: FareDiscountClassName;
  jobOffer: JobOffer;
}

export interface ExplainComparisonRequest {
  kind: "comparison";
  jobA: Omit<ExplainAnalysisRequest, "kind">;
  jobB: Omit<ExplainAnalysisRequest, "kind">;
}

export type ExplainRequest = ExplainAnalysisRequest | ExplainComparisonRequest;

type ExplainJobInput = Omit<ExplainAnalysisRequest, "kind">;

function toExplainJobInput(analysis: JobRealityAnalysis): ExplainJobInput {
  return {
    origin: analysis.origin,
    route: analysis.commute.route,
    discountClass: analysis.fareDiscountClass,
    jobOffer: analysis.jobOffer,
  };
}

export function toExplainAnalysisRequest(analysis: JobRealityAnalysis): ExplainAnalysisRequest {
  return { kind: "analysis", ...toExplainJobInput(analysis) };
}

export function toExplainComparisonRequest(
  comparison: JobRealityComparison,
): ExplainComparisonRequest {
  return {
    kind: "comparison",
    jobA: toExplainJobInput(comparison.jobA),
    jobB: toExplainJobInput(comparison.jobB),
  };
}
