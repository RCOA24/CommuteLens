interface Entry {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Entry>();

/** Best-effort single-instance guard. Deployments should replace this with a shared store. */
export function checkRateLimit(
  request: Request,
  bucket: string,
  limit: number,
  windowMs = 60_000,
): Response | null {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const client = forwarded || request.headers.get("x-real-ip") || "local";
  const key = `${bucket}:${client}`;
  const now = Date.now();
  const current = buckets.get(key);
  const entry =
    !current || current.resetAt <= now
      ? { count: 1, resetAt: now + windowMs }
      : { count: current.count + 1, resetAt: current.resetAt };
  buckets.set(key, entry);

  if (buckets.size > 5_000) {
    for (const [candidate, value] of buckets) if (value.resetAt <= now) buckets.delete(candidate);
  }
  if (entry.count <= limit) return null;

  return Response.json(
    {
      success: false,
      error: { code: "RATE_LIMITED", message: "Too many requests. Please wait and try again." },
    },
    { status: 429, headers: { "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)) } },
  );
}
