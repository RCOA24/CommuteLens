import { z } from "zod";
import { AnalyzeJobOfferUseCase } from "@/application/analyze-job-offer/use-case";
import { analyzeJobOfferSchema } from "@/application/analyze-job-offer/schema";
import { CompareJobOffersUseCase } from "@/application/compare-job-offers/use-case";
import { compareJobOffersSchema } from "@/application/compare-job-offers/schema";
import { buildAnalysisFacts, buildComparisonFacts } from "@/application/explain-analysis/facts";
import { ExplainAnalysisUseCase, type Explanation } from "@/application/explain-analysis/use-case";
import { MockTransitProvider } from "@/providers/transit/mock-transit.provider";
import { OpenAiExplanationProvider } from "@/providers/ai/openai-explanation.provider";
import type { ApiResult } from "@/shared/types/api";

export const runtime = "nodejs";

/**
 * CL-010 — AI explanation endpoint.
 *
 * The request carries analysis *inputs*, not results. The deterministic engines
 * run here first, so the AI can only ever describe authoritative numbers — a
 * client cannot hand it fabricated figures to narrate.
 */
const requestSchema = z.discriminatedUnion("kind", [
  analyzeJobOfferSchema.extend({ kind: z.literal("analysis") }),
  compareJobOffersSchema.extend({ kind: z.literal("comparison") }),
]);

export type ExplainResult = ApiResult<
  Explanation,
  "INVALID_INPUT" | "ROUTE_NOT_FOUND" | "TRANSIT_PROVIDER_UNAVAILABLE"
>;

function invalidInput(message: string): Response {
  return Response.json(
    { success: false, error: { code: "INVALID_INPUT", message } } satisfies ExplainResult,
    { status: 400 },
  );
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidInput("Request body must be valid JSON.");
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return invalidInput(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const transitProvider = new MockTransitProvider();

  if (parsed.data.kind === "analysis") {
    const analysis = await new AnalyzeJobOfferUseCase(transitProvider).execute(parsed.data);
    if (!analysis.success) {
      return Response.json(analysis satisfies ExplainResult, {
        status: analysis.error.code === "INVALID_INPUT" ? 400 : 422,
      });
    }

    const explanation = await explain(buildAnalysisFacts(analysis.data));
    return Response.json({ success: true, data: explanation } satisfies ExplainResult);
  }

  const comparison = await new CompareJobOffersUseCase(transitProvider).execute(parsed.data);
  if (!comparison.success) {
    return Response.json(comparison satisfies ExplainResult, {
      status: comparison.error.code === "INVALID_INPUT" ? 400 : 422,
    });
  }

  const explanation = await explain(buildComparisonFacts(comparison.data));
  return Response.json({ success: true, data: explanation } satisfies ExplainResult);
}

async function explain(facts: Parameters<ExplainAnalysisUseCase["execute"]>[0]) {
  const provider = new OpenAiExplanationProvider();
  return new ExplainAnalysisUseCase(provider.isConfigured ? provider : null).execute(facts);
}
