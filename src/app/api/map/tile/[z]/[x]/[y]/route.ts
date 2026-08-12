import { checkRateLimit } from "@/shared/security/rate-limit";

export const runtime = "nodejs";

const MAX_ZOOM = 20;
const MAP_STYLE = "osm-bright";

function validTilePart(value: string, maximum: number): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= maximum ? parsed : null;
}

/** Keeps the Geoapify tile key on the server; the browser sees same-origin tiles only. */
export async function GET(
  request: Request,
  context: { params: Promise<{ z: string; x: string; y: string }> },
): Promise<Response> {
  const limited = checkRateLimit(request, "map-tiles", 240);
  if (limited) return limited;

  const { z: zParam, x: xParam, y: yParam } = await context.params;
  const z = validTilePart(zParam, MAX_ZOOM);
  if (z === null) return new Response("Invalid map tile.", { status: 400 });
  const tileLimit = 2 ** z - 1;
  const x = validTilePart(xParam, tileLimit);
  const y = validTilePart(yParam, tileLimit);
  if (x === null || y === null) return new Response("Invalid map tile.", { status: 400 });

  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey?.trim()) return new Response("Map temporarily unavailable.", { status: 503 });

  const upstream = new URL(`https://maps.geoapify.com/v1/tile/${MAP_STYLE}/${z}/${x}/${y}.png`);
  upstream.searchParams.set("apiKey", apiKey);
  try {
    const response = await fetch(upstream, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return new Response("Map temporarily unavailable.", { status: 503 });
    return new Response(response.body, {
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new Response("Map temporarily unavailable.", { status: 503 });
  }
}
