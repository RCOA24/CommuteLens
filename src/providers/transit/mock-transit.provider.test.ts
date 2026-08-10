import { describe, expect, it } from "vitest";
import { DEMO_OFFICES, DEMO_ORIGINS, DEMO_ROUTES } from "@/data/demo";
import { commuteRouteSchema } from "@/shared/validation/domain-schemas";
import { MockTransitProvider } from "./mock-transit.provider";

const BAGUIO = { label: "Baguio City", coordinate: { latitude: 16.4023, longitude: 120.596 } };

describe("MockTransitProvider", () => {
  it("returns the curated hero route for the rehearsed corridor", async () => {
    const result = await new MockTransitProvider().findRoutes({
      origin: DEMO_ORIGINS.cubao,
      destination: DEMO_OFFICES.bgc,
    });

    expect(result.status).toBe("success");
    expect(result.routes[0]?.id).toBe("demo-cubao-bgc");
  });

  it("matches an origin that is near, but not identical to, a curated origin", async () => {
    // ~2 km from the curated Cubao point. Exact-coordinate matching would miss it.
    const nearCubao = {
      label: "Near Cubao",
      coordinate: { latitude: 14.6375, longitude: 121.0519 },
    };

    const result = await new MockTransitProvider().findRoutes({
      origin: nearCubao,
      destination: DEMO_OFFICES.bgc,
    });

    expect(result.status).toBe("success");
    expect(result.routes[0]?.id).toBe("demo-cubao-bgc");
  });

  it("does not offer a Makati route for a BGC office", async () => {
    const result = await new MockTransitProvider().findRoutes({
      origin: DEMO_ORIGINS.cubao,
      destination: DEMO_OFFICES.bgc,
    });

    expect(result.routes.map((route) => route.id)).not.toContain("demo-cubao-makati");
  });

  it("reports unsupported corridors instead of guessing", async () => {
    const result = await new MockTransitProvider().findRoutes({
      origin: BAGUIO,
      destination: DEMO_OFFICES.bgc,
    });

    expect(result.status).toBe("unsupported");
    expect(result.routes).toHaveLength(0);
    expect(result.status !== "success" && result.message).toMatch(/demo coverage/i);
  });

  it("reports a provider fault when curated data fails its own invariants", async () => {
    const corrupted = { ...DEMO_ROUTES[0], oneWayFare: 999 };
    const result = await new MockTransitProvider({ routes: [corrupted] }).findRoutes({
      origin: DEMO_ORIGINS.cubao,
      destination: DEMO_OFFICES.bgc,
    });

    expect(result.status).toBe("unavailable");
    expect(result.routes).toHaveLength(0);
  });

  it("is deterministic across repeated lookups", async () => {
    const provider = new MockTransitProvider();
    const request = { origin: DEMO_ORIGINS.alabang, destination: DEMO_OFFICES.bgc };

    const first = await provider.findRoutes(request);
    const second = await provider.findRoutes(request);

    expect(second).toEqual(first);
  });
});

describe("curated demo dataset", () => {
  it("has unique route ids", () => {
    const ids = DEMO_ROUTES.map((route) => route.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("satisfies the shared route contract for every curated route", () => {
    for (const route of DEMO_ROUTES) {
      const parsed = commuteRouteSchema.safeParse(route);
      expect(parsed.success, `${route.id} failed: ${JSON.stringify(parsed.error?.issues)}`).toBe(
        true,
      );
    }
  });

  it("labels every segment as demo or estimated", () => {
    for (const route of DEMO_ROUTES) {
      for (const segment of route.segments) {
        expect(["demo", "estimated"]).toContain(segment.source.type);
      }
    }
  });
});
