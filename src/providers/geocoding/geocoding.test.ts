import { describe, expect, it, vi } from "vitest";
import { DemoGeocodingProvider } from "./demo-geocoding.provider";
import { GeocodingProviderError } from "./errors";
import { FallbackGeocodingProvider } from "./fallback-geocoding.provider";
import { GeoapifyGeocodingProvider } from "./geoapify.provider";
import { NominatimGeocodingProvider } from "./nominatim.provider";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const noThrottle = { minIntervalMs: 1, timeoutMs: 50 };

describe("DemoGeocodingProvider", () => {
  it("finds curated locations by partial label", async () => {
    const results = await new DemoGeocodingProvider().search("bgc");
    expect(results[0]?.label).toBe("BGC, Taguig");
  });

  it("ignores queries that are only whitespace", async () => {
    expect(await new DemoGeocodingProvider().search("   ")).toEqual([]);
  });

  it("returns the caller's coordinate with a nearby label", async () => {
    const coordinate = { latitude: 14.62, longitude: 121.052 };
    const location = await new DemoGeocodingProvider().reverseGeocode(coordinate);
    expect(location?.coordinate).toEqual(coordinate);
    expect(location?.label).toMatch(/Cubao/);
  });

  it("returns null rather than a misleading label when nothing is nearby", async () => {
    expect(
      await new DemoGeocodingProvider().reverseGeocode({ latitude: 16.4023, longitude: 120.596 }),
    ).toBeNull();
  });
});

describe("NominatimGeocodingProvider", () => {
  it("normalizes upstream results into Location values", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse([
          { lat: "14.5508", lon: "121.0501", display_name: "BGC, Taguig, Philippines" },
        ]),
      );

    const results = await new NominatimGeocodingProvider({ ...noThrottle, fetchImpl }).search(
      "BGC Taguig",
    );

    expect(results).toEqual([
      { label: "BGC, Taguig, Philippines", coordinate: { latitude: 14.5508, longitude: 121.0501 } },
    ]);
  });

  it("does not call upstream for a query below the minimum length", async () => {
    const fetchImpl = vi.fn();
    const results = await new NominatimGeocodingProvider({ ...noThrottle, fetchImpl }).search("bg");
    expect(results).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("caches repeated searches", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([]));
    const provider = new NominatimGeocodingProvider({ ...noThrottle, fetchImpl });

    await provider.search("Cubao");
    await provider.search("  cubao ");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("maps an upstream error to a safe provider error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 500));
    const provider = new NominatimGeocodingProvider({ ...noThrottle, fetchImpl });

    await expect(provider.search("Cubao")).rejects.toBeInstanceOf(GeocodingProviderError);
  });

  it("does not leak the upstream failure detail", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED 10.0.0.1:443"));
    const provider = new NominatimGeocodingProvider({ ...noThrottle, fetchImpl });

    await expect(provider.search("Cubao")).rejects.toThrow(/unreachable/i);
    await expect(provider.search("Makati")).rejects.not.toThrow(/10\.0\.0\.1/);
  });

  it("rejects a malformed upstream payload", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ unexpected: true }));
    const provider = new NominatimGeocodingProvider({ ...noThrottle, fetchImpl });

    await expect(provider.search("Cubao")).rejects.toThrow(/unexpected response/i);
  });
});

describe("GeoapifyGeocodingProvider", () => {
  it("uses a Philippines filter and normalizes forward results", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        results: [{ formatted: "BGC, Taguig, Philippines", lat: 14.5508, lon: 121.0501 }],
      }),
    );
    const provider = new GeoapifyGeocodingProvider({ apiKey: "test-key", fetchImpl });

    await expect(provider.search("BGC Taguig")).resolves.toEqual([
      { label: "BGC, Taguig, Philippines", coordinate: { latitude: 14.5508, longitude: 121.0501 } },
    ]);
    const requestUrl = new URL(String(fetchImpl.mock.calls[0]?.[0]));
    expect(requestUrl.pathname).toBe("/v1/geocode/search");
    expect(requestUrl.searchParams.get("filter")).toBe("countrycode:ph");
    expect(requestUrl.searchParams.get("apiKey")).toBe("test-key");
  });

  it("uses reverse geocoding without persisting precise cache keys", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({
        results: [
          { formatted: "Doña Juana Street, Malabon, Philippines", lat: 14.67, lon: 120.96 },
        ],
      }),
    );
    const provider = new GeoapifyGeocodingProvider({ apiKey: "test-key", fetchImpl });
    const location = await provider.reverseGeocode({ latitude: 14.67042, longitude: 120.96049 });
    expect(location?.label).toContain("Malabon");
    expect(new URL(String(fetchImpl.mock.calls[0]?.[0])).pathname).toBe("/v1/geocode/reverse");
  });

  it("does not call Geoapify for short queries", async () => {
    const fetchImpl = vi.fn();
    const provider = new GeoapifyGeocodingProvider({ apiKey: "test-key", fetchImpl });
    await expect(provider.search("bg")).resolves.toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("FallbackGeocodingProvider", () => {
  it("falls back to curated data when the live geocoder fails", async () => {
    const failing = {
      search: async () => {
        throw new GeocodingProviderError("down", "upstream");
      },
      reverseGeocode: async () => {
        throw new GeocodingProviderError("down", "upstream");
      },
    };
    const onFallback = vi.fn();

    const provider = new FallbackGeocodingProvider(
      failing,
      new DemoGeocodingProvider(),
      onFallback,
    );

    expect((await provider.search("bgc"))[0]?.label).toBe("BGC, Taguig");
    expect(onFallback).toHaveBeenCalledWith("upstream");
  });

  it("does not fall back on a legitimate empty result", async () => {
    const empty = { search: async () => [], reverseGeocode: async () => null };
    const onFallback = vi.fn();

    const provider = new FallbackGeocodingProvider(empty, new DemoGeocodingProvider(), onFallback);

    expect(await provider.search("bgc")).toEqual([]);
    expect(onFallback).not.toHaveBeenCalled();
  });
});
