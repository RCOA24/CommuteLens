import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("POST /api/commute/compare", () => {
  it("validates comparison input at the API boundary", async () => {
    const request = new Request("http://localhost/api/commute/compare", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jobA: {}, jobB: {} }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
