import { z } from "zod";
import {
  FareConfirmationValidationError,
  type FareConfirmationSummary,
} from "@/application/fare-confirmation/fare-confirmation.service";
import { getFareConfirmationService } from "@/providers/fare-confirmation";
import { checkRateLimit } from "@/shared/security/rate-limit";
import type { ApiResult } from "@/shared/types/api";
import { commuteRouteSchema } from "@/shared/validation/domain-schemas";

export const runtime = "nodejs";

const discountClassSchema = z.enum(["regular", "student", "senior", "pwd"]);
const routeInputSchema = z.object({
  route: commuteRouteSchema,
  discountClass: discountClassSchema,
});

const requestSchema = z.discriminatedUnion("intent", [
  routeInputSchema.extend({ intent: z.literal("lookup") }),
  routeInputSchema.extend({
    intent: z.literal("confirm"),
    segmentIndex: z.number().int().nonnegative(),
    observedFare: z.number().finite(),
  }),
]);

export type FareConfirmationResult = ApiResult<
  {
    confirmations: FareConfirmationSummary[];
    submission: FareConfirmationSummary | null;
    storage: "session-only";
  },
  "INVALID_INPUT"
>;

function invalidInput(message: string): Response {
  return Response.json(
    { success: false, error: { code: "INVALID_INPUT", message } } satisfies FareConfirmationResult,
    { status: 400 },
  );
}

/**
 * Aggregated commuter-fare overlay. It never stores a route, locations,
 * reporter identity, or a raw submission — only opaque-key fare counts.
 */
export async function POST(request: Request): Promise<Response> {
  const limited = checkRateLimit(request, "fare-confirmations", 10);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidInput("Request body must be valid JSON.");
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return invalidInput(parsed.error.issues[0]?.message ?? "Invalid input.");

  try {
    const service = getFareConfirmationService();
    if (parsed.data.intent === "lookup") {
      return Response.json({
        success: true,
        data: {
          confirmations: service.lookup(parsed.data),
          submission: null,
          storage: "session-only",
        },
      } satisfies FareConfirmationResult);
    }

    const submission = service.confirm(parsed.data);
    return Response.json({
      success: true,
      data: {
        confirmations: service.lookup(parsed.data),
        submission,
        storage: "session-only",
      },
    } satisfies FareConfirmationResult);
  } catch (error) {
    if (error instanceof FareConfirmationValidationError) return invalidInput(error.message);
    throw error;
  }
}
