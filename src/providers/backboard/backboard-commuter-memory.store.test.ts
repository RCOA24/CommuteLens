import { describe, expect, it, vi } from "vitest";
import { BackboardClient } from "./backboard-client";
import { BackboardCommuterMemoryStore } from "./backboard-commuter-memory.store";

/**
 * Regression cover for a deleted file that could not be deleted.
 *
 * When an assistant was already gone, a 404 was reported as a failure. The browser
 * kept a handle it could never clear, so the saved-setup banner stayed on screen
 * permanently with no way to remove it. Absence has to mean success for a delete
 * and emptiness for a read — while real failures still surface.
 */

const HANDLE = "f06e647c-0115-422c-90bf-2c6b86213e34";

function storeRespondingWith(status: number, body = "{}") {
  const fetchImpl = vi
    .fn()
    .mockResolvedValue(
      new Response(body, { status, headers: { "content-type": "application/json" } }),
    );
  const client = new BackboardClient({ apiKey: "test-key", fetchImpl: fetchImpl as typeof fetch });
  return { store: new BackboardCommuterMemoryStore({ client }), fetchImpl };
}

describe("BackboardCommuterMemoryStore", () => {
  it("treats deleting an already-deleted file as done", async () => {
    const { store } = storeRespondingWith(404, JSON.stringify({ detail: "Assistant not found" }));

    await expect(store.forget(HANDLE)).resolves.toBeUndefined();
  });

  it("reads a vanished file as empty rather than as an error", async () => {
    const { store } = storeRespondingWith(404, JSON.stringify({ detail: "Assistant not found" }));

    const snapshot = await store.read(HANDLE);

    expect(snapshot.profile).toBeNull();
    expect(snapshot.offers).toEqual([]);
    expect(snapshot.records).toEqual([]);
  });

  it("still fails loudly when the provider is genuinely broken", async () => {
    const { store } = storeRespondingWith(500);

    await expect(store.forget(HANDLE)).rejects.toThrow(/unavailable/i);
    await expect(store.read(HANDLE)).rejects.toThrow(/unavailable/i);
  });

  it("refuses a handle that could reshape the provider URL", async () => {
    const { store, fetchImpl } = storeRespondingWith(200);

    await expect(store.read("../../assistants")).rejects.toThrow(/not valid/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("removes only the records belonging to one shortlist entry", async () => {
    const memories = {
      memories: [
        { id: "1", content: 'COMMUTELENS_OFFER_V1 {"version":1,"id":"job-1"}' },
        { id: "2", content: "COMMUTELENS_PROFILE_V1 {}" },
      ],
    };
    const fetchImpl = vi.fn().mockImplementation((_url: string, init?: RequestInit) =>
      Promise.resolve(
        new Response(init?.method === "DELETE" ? "{}" : JSON.stringify(memories), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    const client = new BackboardClient({
      apiKey: "test-key",
      fetchImpl: fetchImpl as typeof fetch,
    });
    const store = new BackboardCommuterMemoryStore({ client });

    await store.removeOffer(HANDLE, "job-1");

    // A record that does not parse as this offer is never deleted by accident.
    const deletes = fetchImpl.mock.calls.filter(([, init]) => init?.method === "DELETE");
    expect(deletes).toHaveLength(1);
    expect(String(deletes[0]?.[0])).toContain("/memories/1");
  });
});
