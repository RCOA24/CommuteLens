import { z } from "zod";
import { analyzeJobOfferSchema } from "@/application/analyze-job-offer/schema";
import { AnalyzeJobOfferUseCase } from "@/application/analyze-job-offer/use-case";
import {
  buildOfferLedgerEntry,
  commuterProfileSchema,
} from "@/application/commuter-profile/memory";
import {
  CommuterMemoryService,
  type CommuterForgetResult,
  type CommuterHandleResult,
  type CommuterMemorySnapshotResult,
} from "@/application/commuter-profile/service";
import { isValidHandle } from "@/application/commuter-profile/store";
import { getCommuterMemoryStore } from "@/providers/backboard";
import { getTransitProvider } from "@/providers/transit";
import { checkRateLimit } from "@/shared/security/rate-limit";
import type { ApiResult } from "@/shared/types/api";

export const runtime = "nodejs";

/**
 * Commuter memory endpoint.
 *
 * Everything is explicit: a handle exists only because the user asked to be
 * remembered, and `forget` reports whether the delete actually happened.
 *
 * `remember-offer` takes analysis *inputs* and re-runs the analyzer here, the same
 * way `/api/explain` does. A remembered shortlist therefore always holds figures
 * this app calculated, not figures a client asserted.
 */

const handleSchema = z
  .string()
  .trim()
  .refine(isValidHandle, { message: "That memory handle is not valid." });

/** The server owns `version` and the timestamps, so the client cannot backdate a write. */
const profileInputSchema = commuterProfileSchema.omit({ version: true, updatedAt: true });

const requestSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("create") }),
  z.object({ intent: z.literal("recall"), handle: handleSchema }),
  z.object({
    intent: z.literal("remember"),
    handle: handleSchema,
    profile: profileInputSchema,
  }),
  z.object({
    intent: z.literal("remember-offer"),
    handle: handleSchema,
    offer: analyzeJobOfferSchema,
  }),
  z.object({
    intent: z.literal("forget-offer"),
    handle: handleSchema,
    offerId: z.string().trim().min(1).max(80),
  }),
  z.object({ intent: z.literal("forget"), handle: handleSchema }),
]);

export type CommuterMemoryApiData =
  | ({ kind: "handle" } & CommuterHandleResult)
  | ({ kind: "snapshot" } & CommuterMemorySnapshotResult)
  | ({ kind: "forget" } & CommuterForgetResult);

export type CommuterMemoryResult = ApiResult<
  CommuterMemoryApiData,
  "INVALID_INPUT" | "ROUTE_NOT_FOUND" | "TRANSIT_PROVIDER_UNAVAILABLE"
>;

function invalidInput(message: string): Response {
  return Response.json(
    { success: false, error: { code: "INVALID_INPUT", message } } satisfies CommuterMemoryResult,
    { status: 400 },
  );
}

export async function POST(request: Request): Promise<Response> {
  const limited = checkRateLimit(request, "commuter-memory", 20);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidInput("Request body must be valid JSON.");
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return invalidInput(parsed.error.issues[0]?.message ?? "Invalid input.");

  const service = new CommuterMemoryService(getCommuterMemoryStore());
  const command = parsed.data;

  if (command.intent === "create") {
    return ok({ kind: "handle", ...(await service.createHandle()) });
  }

  if (command.intent === "recall") {
    return ok({ kind: "snapshot", ...(await service.recall(command.handle)) });
  }

  if (command.intent === "forget") {
    return ok({ kind: "forget", ...(await service.forget(command.handle)) });
  }

  if (command.intent === "forget-offer") {
    const snapshot = await service.forgetOffer(command.handle, command.offerId);
    return ok({ kind: "snapshot", ...snapshot });
  }

  if (command.intent === "remember") {
    const snapshot = await service.remember(command.handle, {
      version: 1,
      ...command.profile,
      updatedAt: new Date().toISOString(),
    });
    return ok({ kind: "snapshot", ...snapshot });
  }

  const analysis = await new AnalyzeJobOfferUseCase(getTransitProvider()).execute(command.offer);
  if (!analysis.success) {
    return Response.json(analysis satisfies CommuterMemoryResult, {
      status: analysis.error.code === "INVALID_INPUT" ? 400 : 422,
    });
  }

  const snapshot = await service.rememberOffer(
    command.handle,
    buildOfferLedgerEntry(analysis.data),
  );
  return ok({ kind: "snapshot", ...snapshot });
}

function ok(data: CommuterMemoryApiData): Response {
  return Response.json({ success: true, data } satisfies CommuterMemoryResult);
}
