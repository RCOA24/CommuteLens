import { describe, expect, it } from "vitest";
import { DEMO_LOCATIONS } from "@/data/demo-routes";
import { POST } from "./route";

describe("POST /api/commute/analyze", () => {
  it("returns a deterministic analysis response", async () => {
    const request = new Request("http://localhost/api/commute/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        origin: DEMO_LOCATIONS.cubao,
        jobOffer: {
          id: "job-a",
          title: "Developer",
          company: "Example",
          monthlySalary: 45_000,
          officeLocation: DEMO_LOCATIONS.bgc,
          workArrangement: "hybrid",
          onsiteDaysPerWeek: 3,
          workingHoursPerDay: 8,
        },
      }),
    });

    const response = await POST(request);
    const body = (await response.json()) as { success: boolean };
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("returns a safe 400 response for malformed JSON", async () => {
    const request = new Request("http://localhost/api/commute/analyze", {
      method: "POST",
      body: "{",
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
