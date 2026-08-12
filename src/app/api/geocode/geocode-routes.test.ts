import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Location } from "@/domain/models";
import { resetGeocodingProvider } from "@/providers/geocoding";
import { POST as reverse } from "./reverse/route";
import { GET as search } from "./search/route";

// Force the offline curated geocoder so these tests never touch the network.
beforeEach(() => {
  process.env.GEOCODING_PROVIDER = "demo";
  resetGeocodingProvider();
});

afterEach(() => {
  delete process.env.GEOCODING_PROVIDER;
  resetGeocodingProvider();
});

describe("GET /api/geocode/search", () => {
  it("returns normalized locations", async () => {
    const response = await search(new Request("http://localhost/api/geocode/search?q=BGC"));
    const body = (await response.json()) as { success: true; data: { results: Location[] } };

    expect(response.status).toBe(200);
    expect(body.data.results[0]?.label).toBe("BGC, Taguig");
  });

  it("rejects a query that is too short", async () => {
    const response = await search(new Request("http://localhost/api/geocode/search?q=b"));
    expect(response.status).toBe(400);
  });

  it("rejects a missing query", async () => {
    const response = await search(new Request("http://localhost/api/geocode/search"));
    expect(response.status).toBe(400);
  });
});

function reverseRequest(body: unknown) {
  return new Request("http://localhost/api/geocode/reverse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/geocode/reverse", () => {
  it("resolves a coordinate to a labelled location", async () => {
    const response = await reverse(reverseRequest({ latitude: 14.62, longitude: 121.052 }));
    const body = (await response.json()) as { success: true; data: { location: Location | null } };

    expect(response.status).toBe(200);
    expect(body.data.location?.label).toMatch(/Cubao/);
  });

  it("returns null rather than guessing for an unknown area", async () => {
    const response = await reverse(reverseRequest({ latitude: 16.4023, longitude: 120.596 }));
    const body = (await response.json()) as { success: true; data: { location: Location | null } };

    expect(body.data.location).toBeNull();
  });

  it("rejects an out-of-range coordinate", async () => {
    const response = await reverse(reverseRequest({ latitude: 999, longitude: 0 }));
    expect(response.status).toBe(400);
  });

  it("rejects a non-numeric coordinate", async () => {
    const response = await reverse(reverseRequest({ latitude: "abc", longitude: 121 }));
    expect(response.status).toBe(400);
  });
});
