import { coordinateSchema } from "@/shared/validation/domain-schemas";
import { getGeocodingProvider } from "@/providers/geocoding";
import type { ApiResult } from "@/shared/types/api";
import type { Location } from "@/domain/models";
import { checkRateLimit } from "@/shared/security/rate-limit";

export const runtime = "nodejs";

const requestSchema = coordinateSchema;

export type GeocodeReverseResult = ApiResult<
  { location: Location | null },
  "INVALID_INPUT" | "GEOCODING_FAILED"
>;

/**
 * CL-004 — reverse geocoding for the browser "Use my location" flow.
 *
 * The coordinate is used for this request and forwarded to the configured
 * geocoder. The app does not persist it or place it in the request URL.
 */
export async function POST(request: Request): Promise<Response> {
  const limited = checkRateLimit(request, "geocode-reverse", 10);
  if (limited) return limited;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        error: { code: "INVALID_INPUT", message: "A valid latitude and longitude are required." },
      } satisfies GeocodeReverseResult,
      { status: 400 },
    );
  }

  try {
    const location = await getGeocodingProvider().reverseGeocode(parsed.data);
    return Response.json({ success: true, data: { location } } satisfies GeocodeReverseResult);
  } catch {
    return Response.json(
      {
        success: false,
        error: {
          code: "GEOCODING_FAILED",
          message: "We could not identify that location right now.",
        },
      } satisfies GeocodeReverseResult,
      { status: 503 },
    );
  }
}
