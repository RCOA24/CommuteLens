import { z } from "zod";
import {
  recommendCommuteRoute,
  type CommuteRouteRecommendation,
} from "@/application/guide-commute/commute-guide";
import { OpenAiCommuteGuideProvider } from "@/providers/ai/openai-commute-guide.provider";
import { checkRateLimit } from "@/shared/security/rate-limit";
import type { ApiResult } from "@/shared/types/api";
import { commuteRouteSchema } from "@/shared/validation/domain-schemas";

const requestSchema = z.object({ routes: z.array(commuteRouteSchema).min(1).max(3) });

export type CommuteRecommendationResult = ApiResult<
  CommuteRouteRecommendation,
  "INVALID_INPUT"
>;

/**
 * Recommends only among provider-returned route candidates. It deliberately
 * cannot produce a route, service, or stop that was not in the candidate set.
 */
export async function POST(request: Request): Promise<Response> {
  const limited = checkRateLimit(request, "commute-recommend", 8);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        success: false,
        error: { code: "INVALID_INPUT", message: "Request body must be valid JSON." },
      } satisfies CommuteRecommendationResult,
      { status: 400 },
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        error: { code: "INVALID_INPUT", message: "Provide one to three route options." },
      } satisfies CommuteRecommendationResult,
      { status: 400 },
    );
  }

  const provider = new OpenAiCommuteGuideProvider();
  const recommendation = await recommendCommuteRoute(
    parsed.data.routes,
    provider.isConfigured ? provider : null,
  );
  return Response.json({ success: true, data: recommendation } satisfies CommuteRecommendationResult);
}
