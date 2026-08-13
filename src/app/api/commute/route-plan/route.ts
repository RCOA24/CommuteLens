import { z } from "zod";
import {
  researchCommuteRoute,
  RouteResearchError,
  type ResearchedCommuteRoutePlan,
} from "@/application/research-commute-route/research-route";
import { OpenAiRouteResearchProvider } from "@/providers/ai/openai-route-research.provider";
import { checkRateLimit } from "@/shared/security/rate-limit";
import type { ApiResult } from "@/shared/types/api";
import { commuteRouteSchema } from "@/shared/validation/domain-schemas";

const MAX_BODY_CHARACTERS = 48_000;
const requestSchema = z.object({ route: commuteRouteSchema });

export type CommuteRoutePlanResult = ApiResult<
  ResearchedCommuteRoutePlan,
  "INVALID_INPUT" | "AI_UNAVAILABLE"
>;

function failureStatus(reason: RouteResearchError["reason"]): number {
  if (reason === "not-configured") return 503;
  if (reason === "timeout") return 504;
  return 502;
}

function failureMessage(reason: RouteResearchError["reason"]): string {
  if (reason === "not-configured") {
    return "Web directions are not available on this server. Your route estimate is still available.";
  }
  if (reason === "timeout") {
    return "Web directions could not be verified in time. Your route estimate is still available.";
  }
  if (reason === "guardrail") {
    return "Web directions could not be verified with enough source evidence. Your route estimate is still available.";
  }
  return "Web directions are unavailable right now. Your route estimate is still available.";
}

/** Optional web research only; its output never changes the selected or priced route. */
export async function POST(request: Request): Promise<Response> {
  const limited = checkRateLimit(request, "commute-route-plan", 4);
  if (limited) return limited;

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_CHARACTERS) {
    return Response.json(
      {
        success: false,
        error: { code: "INVALID_INPUT", message: "The route request is too large." },
      } satisfies CommuteRoutePlanResult,
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return Response.json(
      {
        success: false,
        error: { code: "INVALID_INPUT", message: "Request body must be valid JSON." },
      } satisfies CommuteRoutePlanResult,
      { status: 400 },
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (
    !parsed.success ||
    parsed.data.route.segments.length > 12 ||
    parsed.data.route.sources.length > 16
  ) {
    return Response.json(
      {
        success: false,
        error: { code: "INVALID_INPUT", message: "Provide one valid, bounded commute route." },
      } satisfies CommuteRoutePlanResult,
      { status: 400 },
    );
  }

  const provider = new OpenAiRouteResearchProvider();
  try {
    const plan = await researchCommuteRoute(
      parsed.data.route,
      provider.isConfigured ? provider : null,
      request.signal,
    );
    return Response.json({ success: true, data: plan } satisfies CommuteRoutePlanResult);
  } catch (error) {
    const reason = error instanceof RouteResearchError ? error.reason : "upstream";
    return Response.json(
      {
        success: false,
        error: { code: "AI_UNAVAILABLE", message: failureMessage(reason) },
      } satisfies CommuteRoutePlanResult,
      { status: failureStatus(reason) },
    );
  }
}
