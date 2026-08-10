import { describe, expect, it } from "vitest";
import { DEMO_OFFICES, DEMO_ORIGINS, PRIMARY_DEMO_SCENARIO } from "@/data/demo";
import type { Explanation } from "@/application/explain-analysis/use-case";
import { POST } from "./route";

function post(body: unknown): Request {
  return new Request("http://localhost/api/explain", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const heroBody = {
  kind: "analysis",
  origin: PRIMARY_DEMO_SCENARIO.origin,
  jobOffer: PRIMARY_DEMO_SCENARIO.jobOffer,
};

describe("POST /api/explain", () => {
  it("returns a deterministic explanation when no AI key is configured", async () => {
    const response = await POST(post(heroBody));
    const body = (await response.json()) as { success: true; data: Explanation };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.source).toBe("deterministic");
    expect(body.data.text.length).toBeGreaterThan(0);
  });

  it("explains a comparison from the same engines", async () => {
    const response = await POST(
      post({
        kind: "comparison",
        jobA: { origin: PRIMARY_DEMO_SCENARIO.origin, jobOffer: PRIMARY_DEMO_SCENARIO.jobOffer },
        jobB: {
          origin: DEMO_ORIGINS.alabang,
          jobOffer: {
            ...PRIMARY_DEMO_SCENARIO.jobOffer,
            id: "job-b",
            monthlySalary: 85_000,
            officeLocation: DEMO_OFFICES.bgc,
          },
        },
      }),
    );

    const body = (await response.json()) as { success: true; data: Explanation };
    expect(response.status).toBe(200);
    expect(body.data.text).toMatch(/commute/i);
  });

  it("surfaces an unsupported corridor instead of narrating around it", async () => {
    const response = await POST(
      post({
        kind: "analysis",
        origin: { label: "Baguio City", coordinate: { latitude: 16.4023, longitude: 120.596 } },
        jobOffer: { ...PRIMARY_DEMO_SCENARIO.jobOffer, workArrangement: "onsite" },
      }),
    );

    const body = (await response.json()) as { success: false; error: { code: string } };
    expect(response.status).toBe(422);
    expect(body.error.code).toBe("ROUTE_NOT_FOUND");
  });

  it("rejects a request that omits the kind discriminator", async () => {
    const response = await POST(post({ origin: DEMO_ORIGINS.cubao }));
    expect(response.status).toBe(400);
  });

  it("returns a safe 400 for malformed JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/explain", { method: "POST", body: "{" }),
    );
    expect(response.status).toBe(400);
  });
});
