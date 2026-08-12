import { z } from "zod";
import {
  AssessCommuteReadinessUseCase,
  type CommuteReadiness,
} from "@/application/assess-commute-readiness/use-case";
import { getWeatherProvider } from "@/providers/weather";
import { checkRateLimit } from "@/shared/security/rate-limit";
import type { ApiResult } from "@/shared/types/api";
import { commuteRouteSchema } from "@/shared/validation/domain-schemas";
const requestSchema = z.object({
  route: commuteRouteSchema.nullable(),
  /** Defaults to the current Philippine date when not supplied. */
  travelDate: z.iso.date().optional(),
});
export type CommuteReadinessResult = ApiResult<CommuteReadiness, "INVALID_INPUT">;
function invalidInput(message: string): Response {
  return Response.json(
    { success: false, error: { code: "INVALID_INPUT", message } } satisfies CommuteReadinessResult,
    { status: 400 },
  );
}
/**
 * Transient route conditions. This endpoint is intentionally independent from
 * /analyze: weather outages must never make a completed commute analysis fail.
 */
export async function POST(request: Request): Promise<Response> {
  const limited = checkRateLimit(request, "commute-readiness", 20);
  if (limited) return limited;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidInput("Request body must be valid JSON.");
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return invalidInput(parsed.error.issues[0]?.message ?? "Invalid input.");
  const readiness = await new AssessCommuteReadinessUseCase(getWeatherProvider()).execute(
    parsed.data,
  );
  return Response.json({ success: true, data: readiness } satisfies CommuteReadinessResult);
}
