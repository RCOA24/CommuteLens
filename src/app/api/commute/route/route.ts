import { z } from "zod";
import { deduplicateCommuteRoutes } from "@/application/route-preview/deduplicate-routes";
import type { CommuteRoute } from "@/domain/models";
import { getTransitProvider } from "@/providers/transit";
import type { ApiResult } from "@/shared/types/api";
import { locationSchema } from "@/shared/validation/domain-schemas";
import { checkRateLimit } from "@/shared/security/rate-limit";

const requestSchema = z.object({
  origin: locationSchema,
  destination: locationSchema,
  /** Statutory fare entitlement. Defaults to full fare when omitted. */
  discountClass: z.enum(["regular", "student", "senior", "pwd"]).default("regular"),
});

export type RoutePreviewResult = ApiResult<
  { routes: CommuteRoute[] },
  "INVALID_INPUT" | "ROUTE_NOT_FOUND" | "TRANSIT_PROVIDER_UNAVAILABLE"
>;

/** Server-side route discovery used before the offer form is shown. */
export async function POST(request: Request): Promise<Response> {
  const limited = checkRateLimit(request, "commute-route", 30);
  if (limited) return limited;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      {
        success: false,
        error: { code: "INVALID_INPUT", message: "Request body must be valid JSON." },
      } satisfies RoutePreviewResult,
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
          message: "Choose a location from each search result list.",
        },
      } satisfies RoutePreviewResult,
      { status: 400 },
    );
  }
  const result = await getTransitProvider().findRoutes(parsed.data);
  if (result.status === "success")
    return Response.json({
      success: true,
      data: { routes: deduplicateCommuteRoutes(result.routes).slice(0, 3) },
    } satisfies RoutePreviewResult);
  return Response.json(
    {
      success: false,
      error: {
        code: result.status === "unsupported" ? "ROUTE_NOT_FOUND" : "TRANSIT_PROVIDER_UNAVAILABLE",
        message: result.message,
      },
    } satisfies RoutePreviewResult,
    { status: 422 },
  );
}
