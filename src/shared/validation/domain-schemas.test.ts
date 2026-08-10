import { describe, expect, it } from "vitest";
import { DEMO_ROUTES } from "@/data/demo-routes";
import { commuteRouteSchema } from "./domain-schemas";

describe("commuteRouteSchema", () => {
  it("accepts a normalized route whose totals match its segments", () => {
    expect(commuteRouteSchema.safeParse(DEMO_ROUTES[0]).success).toBe(true);
  });

  it("rejects provider totals that disagree with segments", () => {
    const route = { ...DEMO_ROUTES[0], oneWayFare: 999 };
    expect(commuteRouteSchema.safeParse(route).success).toBe(false);
  });

  it("requires provenance on every segment", () => {
    const route = {
      ...DEMO_ROUTES[0],
      segments: [{ ...DEMO_ROUTES[0].segments[0], source: undefined }],
      transfers: 0,
    };
    expect(commuteRouteSchema.safeParse(route).success).toBe(false);
  });
});
