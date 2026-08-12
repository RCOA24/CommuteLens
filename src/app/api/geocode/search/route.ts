import { z } from "zod";
import { getGeocodingProvider } from "@/providers/geocoding";
import type { ApiResult } from "@/shared/types/api";
import type { Location } from "@/domain/models";
import { checkRateLimit } from "@/shared/security/rate-limit";

export const runtime = "nodejs";

const querySchema = z.object({ q: z.string().trim().min(3).max(120) });

export type GeocodeSearchResult = ApiResult<
  { results: Location[] },
  "INVALID_INPUT" | "GEOCODING_FAILED"
>;

/** CL-004 — server-side location search. Keeps the geocoder off the client. */
export async function GET(request: Request): Promise<Response> {
  const limited = checkRateLimit(request, "geocode-search", 20);
  if (limited) return limited;
  const parsed = querySchema.safeParse({
    q: new URL(request.url).searchParams.get("q") ?? "",
  });

  if (!parsed.success) {
    return Response.json(
      {
        success: false,
        error: { code: "INVALID_INPUT", message: "Enter at least 3 characters to search." },
      } satisfies GeocodeSearchResult,
      { status: 400 },
    );
  }

  try {
    const results = await getGeocodingProvider().search(parsed.data.q);
    return Response.json({ success: true, data: { results } } satisfies GeocodeSearchResult);
  } catch {
    // The fallback provider already absorbs recoverable faults, so reaching here
    // means both the live and curated geocoders failed.
    return Response.json(
      {
        success: false,
        error: { code: "GEOCODING_FAILED", message: "Location search is temporarily unavailable." },
      } satisfies GeocodeSearchResult,
      { status: 503 },
    );
  }
}
