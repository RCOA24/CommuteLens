import { describe, expect, it } from "vitest";
import { DEMO_LOCATIONS } from "@/data/demo-routes";
import { POST } from "./route";
import type { CommuterMemoryApiData } from "./route";

/**
 * The provider factory returns the process-local store under NODE_ENV=test, so
 * these run offline and assert the full remember/recall/forget contract.
 */

let client = 0;

async function post(body: unknown) {
  const request = new Request("http://localhost/api/commuter-profile", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // A distinct client per call keeps the shared rate-limit bucket out of the way.
      "x-forwarded-for": `10.0.0.${++client % 250}`,
    },
    body: JSON.stringify(body),
  });
  const response = await POST(request);
  return {
    status: response.status,
    body: (await response.json()) as
      | { success: true; data: CommuterMemoryApiData }
      | { success: false; error: { code: string; message: string } },
  };
}

const PROFILE = {
  homeLabel: "Guiguinto, Bulacan",
  homeCoordinate: { latitude: 14.8259371, longitude: 120.8817462 },
  fareClass: "student",
  workArrangement: "hybrid",
  workingHoursPerDay: 8,
  takeHomePercent: 90,
  maxOneWayMinutes: null,
};

async function createHandle(): Promise<string> {
  const created = await post({ intent: "create" });
  if (!created.body.success || created.body.data.kind !== "handle" || !created.body.data.handle) {
    throw new Error("handle was not created");
  }
  return created.body.data.handle;
}

describe("POST /api/commuter-profile", () => {
  it("rejects malformed JSON with a safe 400", async () => {
    const request = new Request("http://localhost/api/commuter-profile", {
      method: "POST",
      headers: { "x-forwarded-for": "10.1.0.1" },
      body: "{",
    });
    expect((await POST(request)).status).toBe(400);
  });

  it("rejects a handle that is not a UUID", async () => {
    const result = await post({ intent: "recall", handle: "../../assistants" });

    expect(result.status).toBe(400);
    expect(result.body.success).toBe(false);
  });

  it("reports the storage durability of the store actually in use", async () => {
    const created = await post({ intent: "create" });

    expect(created.body.success).toBe(true);
    if (!created.body.success || created.body.data.kind !== "handle") throw new Error("bad shape");
    expect(created.body.data.storage).toBe("session-only");
  });

  it("remembers a profile and recalls it, with the coordinate coarsened", async () => {
    const handle = await createHandle();

    const remembered = await post({ intent: "remember", handle, profile: PROFILE });
    expect(remembered.body.success).toBe(true);

    const recalled = await post({ intent: "recall", handle });
    if (!recalled.body.success || recalled.body.data.kind !== "snapshot") {
      throw new Error("bad shape");
    }
    expect(recalled.body.data.profile?.fareClass).toBe("student");
    expect(recalled.body.data.profile?.homeCoordinate).toEqual({
      latitude: 14.826,
      longitude: 120.882,
    });
    expect(recalled.body.data.records).toHaveLength(1);
  });

  it("replaces the stored profile rather than accumulating versions", async () => {
    const handle = await createHandle();

    await post({ intent: "remember", handle, profile: PROFILE });
    await post({ intent: "remember", handle, profile: { ...PROFILE, takeHomePercent: 75 } });

    const recalled = await post({ intent: "recall", handle });
    if (!recalled.body.success || recalled.body.data.kind !== "snapshot") {
      throw new Error("bad shape");
    }
    expect(recalled.body.data.records).toHaveLength(1);
    expect(recalled.body.data.profile?.takeHomePercent).toBe(75);
  });

  it("recalculates a remembered offer from its inputs instead of trusting the client", async () => {
    const handle = await createHandle();

    const remembered = await post({
      intent: "remember-offer",
      handle,
      offer: {
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
      },
    });

    if (!remembered.body.success || remembered.body.data.kind !== "snapshot") {
      throw new Error("bad shape");
    }
    const [offer] = remembered.body.data.offers;
    expect(offer?.title).toBe("Developer");
    expect(offer?.monthlySalary).toBe(45_000);
    // Proof the figure came from the analyzer, not from the request body.
    expect(offer?.incomeAfterCommute).toBeGreaterThan(0);
    expect(offer?.incomeAfterCommute).toBeLessThan(45_000);
  });

  it("rejects an offer payload the analyzer would refuse", async () => {
    const handle = await createHandle();

    const result = await post({
      intent: "remember-offer",
      handle,
      offer: {
        origin: DEMO_LOCATIONS.cubao,
        jobOffer: {
          id: "job-b",
          title: "Developer",
          company: "Example",
          monthlySalary: -5,
          officeLocation: DEMO_LOCATIONS.bgc,
          workArrangement: "remote",
          onsiteDaysPerWeek: 0,
          workingHoursPerDay: 8,
        },
      },
    });

    expect(result.status).toBe(400);
    expect(result.body.success).toBe(false);
  });

  it("forgets everything behind a handle and confirms the deletion happened", async () => {
    const handle = await createHandle();
    await post({ intent: "remember", handle, profile: PROFILE });

    const forgotten = await post({ intent: "forget", handle });
    if (!forgotten.body.success || forgotten.body.data.kind !== "forget") {
      throw new Error("bad shape");
    }
    expect(forgotten.body.data.forgotten).toBe(true);

    const recalled = await post({ intent: "recall", handle });
    if (!recalled.body.success || recalled.body.data.kind !== "snapshot") {
      throw new Error("bad shape");
    }
    expect(recalled.body.data.profile).toBeNull();
    expect(recalled.body.data.records).toEqual([]);
  });
});
