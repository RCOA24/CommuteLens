import { z } from "zod";
import { coordinateSchema } from "@/shared/validation/domain-schemas";
import { getGeocodingProvider } from "@/providers/geocoding";
import type { ApiResult } from "@/shared/types/api";
import type { Location } from "@/domain/models";

export const runtime = "nodejs";

const querySchema = z.object({
  lat: z.coerce.number(),
  lon: z.coerce.number(),
});

export type GeocodeReverseResult = ApiResult<
  { location: Location | null },
  "INVALID_INPUT" | "GEOCODING_FAILED"
>;

/**
 * CL-004 — reverse geocoding for the browser "Use my location" flow.
 *
 * The coordinate is used for this request only: it is not logged, cached at
 * full precision, or forwarded anywhere else.
 */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const parsedQuery = querySchema.safeParse({
    lat: params.get("lat"),
    lon: params.get("lon"),
  });
  const parsed = parsedQuery.success
    ? coordinateSchema.safeParse({
        latitude: parsedQuery.data.lat,
        longitude: parsedQuery.data.lon,
      })
    : null;

  if (!parsed?.success) {
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
