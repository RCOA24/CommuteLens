import { describe, expect, it } from "vitest";
import { DEMO_ROUTES } from "@/data/demo";
import type { FareConfirmationResult } from "./route";
import { POST } from "./route";

const regularRailRoute = DEMO_ROUTES[0]!;
const routeWithWalkingLeg = DEMO_ROUTES[1]!;

function post(body: unknown, client = "198.51.100.40"): Request {
  return new Request("http://localhost/api/fare-confirmations", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": client },
    body: JSON.stringify(body),
  });
}

describe("POST /api/fare-confirmations", () => {
  it("rejects an invalid segment and a walking leg without storing the request route", async () => {
    const invalidSegment = await POST(
      post({
        intent: "confirm",
        route: regularRailRoute,
        discountClass: "regular",
        segmentIndex: 99,
        observedFare: 28,
      }),
    );
    const walkingLeg = await POST(
      post(
        {
          intent: "confirm",
          route: routeWithWalkingLeg,
          discountClass: "regular",
          segmentIndex: 1,
          observedFare: 20,
        },
        "198.51.100.41",
      ),
    );

    expect(invalidSegment.status).toBe(400);
    expect(walkingLeg.status).toBe(400);
  });

  it("returns only opaque aggregate confirmation data", async () => {
    const response = await POST(
      post({
        intent: "confirm",
        route: regularRailRoute,
        discountClass: "regular",
        segmentIndex: 0,
        observedFare: 28,
      }),
    );
    const body = (await response.json()) as FareConfirmationResult;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    if (!body.success) return;
    const serialized = JSON.stringify(body.data);
    expect(serialized).not.toContain(regularRailRoute.id);
    expect(serialized).not.toContain(regularRailRoute.segments[0]!.origin.label);
    expect(serialized).not.toContain(
      String(regularRailRoute.segments[0]!.origin.coordinate.longitude),
    );
    expect(body.data.submission?.segmentKey).toMatch(/^fare-leg:v1:rail:0:regular:/);
    expect(body.data.storage).toBe("session-only");
  });

  it("rate-limits confirmation traffic independently", async () => {
    const requestBody = { intent: "lookup", route: regularRailRoute, discountClass: "regular" };
    const client = "198.51.100.99";
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect((await POST(post(requestBody, client))).status).toBe(200);
    }

    const limited = await POST(post(requestBody, client));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).not.toBeNull();
  });
});
