import { z } from "zod";
import { guideCommute, type CommuteGuide } from "@/application/guide-commute/commute-guide";
import { OpenAiCommuteGuideProvider } from "@/providers/ai/openai-commute-guide.provider";
import { checkRateLimit } from "@/shared/security/rate-limit";
import type { ApiResult } from "@/shared/types/api";
import { commuteRouteSchema } from "@/shared/validation/domain-schemas";

const requestSchema = z.object({ route: commuteRouteSchema });

export type CommuteGuideResult = ApiResult<CommuteGuide, "INVALID_INPUT" | "AI_UNAVAILABLE">;

export async function POST(request: Request): Promise<Response> {
  const limited = checkRateLimit(request, "commute-guide", 8);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        success: false,
        error: { code: "INVALID_INPUT", message: "Request body must be valid JSON." },
      } satisfies CommuteGuideResult,
      { status: 400 },
    );
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: parsed.error.issues[0]?.message ?? "Invalid route.",
        },
      } satisfies CommuteGuideResult,
      { status: 400 },
    );
  }

  const provider = new OpenAiCommuteGuideProvider();
  const guide = await guideCommute(parsed.data.route, provider.isConfigured ? provider : null);
  return Response.json({ success: true, data: guide } satisfies CommuteGuideResult);
}
