import { describe, expect, it, vi } from "vitest";
import { DEMO_OFFICES, DEMO_ORIGINS } from "@/data/demo";
import { BusMapsTransitProvider } from "./busmaps-transit.provider";

/** Cubao and BGC are ~8 km apart, so distance-based fares are well clear of the base band. */
const section = (mode: string, duration: number) => ({
  travelSummary: { duration },
  departure: { place: { name: "Start", location: { lat: 14.6195, lng: 121.0519 } } },
  arrival: { place: { name: "End", location: { lat: 14.5508, lng: 121.0501 } } },
  transport: { mode },
});

function stubFetch(sections: unknown[]) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify({ routes: [{ id: "route", sections }] }), { status: 200 }),
  ) as unknown as typeof fetch;
}

function provider(
  sections: unknown[],
  endpoints: { origin: typeof DEMO_ORIGINS.cubao; destination: typeof DEMO_OFFICES.bgc } = {
    origin: DEMO_ORIGINS.cubao,
    destination: DEMO_OFFICES.bgc,
  },
) {
  return new BusMapsTransitProvider({ apiKey: "test", fetchImpl: stubFetch(sections) }).findRoutes(
    endpoints,
  );
}

describe("BusMapsTransitProvider", () => {
  it("excludes access walks from transfer count and attributes fares per mode", async () => {
    const result = await provider([
      section("pedestrian", 300),
      section("train", 1200),
      section("pedestrian", 180),
      section("bus", 600),
      section("pedestrian", 120),
    ]);

    expect(result.status).toBe("success");
    if (result.status !== "success") return;
    expect(result.routes[0].transfers).toBe(1);

    // Routing provenance first, then one fare source per priced mode. The
    // previous single "fare estimate" label could not distinguish a regulated
    // rate from a guessed band.
    const names = result.routes[0].sources.map((source) => source.name);
    expect(names[0]).toBe("BusMaps live transit routing");
    expect(names.length).toBeGreaterThan(1);
    expect(names.some((name) => name.includes("rail fare band"))).toBe(true);
  });

  it("keeps walking legs free and attributes them to routing, not to a fare", async () => {
    const result = await provider([section("pedestrian", 300), section("bus", 600)]);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    const walk = result.routes[0].segments.find((segment) => segment.mode === "walk");
    expect(walk?.estimatedFare).toBe(0);
    expect(walk?.source.name).toBe("BusMaps live transit routing");
  });

  /**
   * Regression: BusMaps only emits bus/subway/train/tram/pedestrian, so every
   * other vehicle used to fall through a flat fare table and cost ₱0 — telling
   * users that jeepney-class legs were free.
   */
  it("never reports an unrecognised vehicle as free", async () => {
    const result = await provider([section("ferry", 900)]);
    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    const [segment] = result.routes[0].segments;
    expect(segment.mode).toBe("other");
    expect(segment.estimatedFare).toBeGreaterThan(0);
    expect(result.routes[0].oneWayFare).toBeGreaterThan(0);
  });

  /**
   * Regression: a flat per-mode fare table charged the same for a two-station
   * hop as for an end-to-end ride. The provider snaps a route's ends to the
   * locations the user actually chose, so the corridor is what must move the
   * fare — the same single bus leg costs more across a longer corridor.
   */
  it("charges more for the same mode across a longer corridor", async () => {
    const nearby = await provider([section("bus", 600)], {
      origin: DEMO_ORIGINS.cubao,
      destination: DEMO_OFFICES.eastwood,
    });
    const faraway = await provider([section("bus", 600)], {
      origin: DEMO_ORIGINS.alabang,
      destination: DEMO_OFFICES.eastwood,
    });
    if (nearby.status !== "success" || faraway.status !== "success") {
      throw new Error("both fixtures should route");
    }
    expect(faraway.routes[0].oneWayFare).toBeGreaterThan(nearby.routes[0].oneWayFare);
  });
});
