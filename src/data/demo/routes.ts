import type {
  CommuteRoute,
  CommuteSegment,
  DataSource,
  Location,
  TransportMode,
} from "@/domain/models";
import { countTransitTransfers } from "@/domain/commute/route-metrics";
import { DEMO_INTERCHANGES, DEMO_OFFICES, DEMO_ORIGINS } from "./locations";
import { DEMO_SOURCE, ESTIMATED_SOURCE } from "./sources";

/**
 * CL-005 — curated Metro Manila demo routes.
 *
 * Totals are never hand-typed. `buildRoute` derives `oneWayFare`,
 * `oneWayDurationMinutes`, `transfers`, and `sources` from the segments so the
 * dataset cannot drift out of the invariants enforced by `commuteRouteSchema`.
 *
 * Fares and durations are typical off-peak-to-moderate-traffic values for the
 * corridor. They are labelled Demo/Estimated and must never be presented as a
 * live or guaranteed journey.
 */

interface SegmentSpec {
  mode: TransportMode;
  from: Location;
  to: Location;
  fare: number;
  minutes: number;
  /** Defaults to the curated demo source. Use `estimated` for fare-band guesses. */
  provenance?: DataSource;
}

function buildRoute(
  id: string,
  reliability: CommuteRoute["reliability"],
  specs: readonly SegmentSpec[],
): CommuteRoute {
  const segments: CommuteSegment[] = specs.map((spec) => ({
    mode: spec.mode,
    origin: spec.from,
    destination: spec.to,
    estimatedFare: spec.fare,
    estimatedDurationMinutes: spec.minutes,
    source: spec.provenance ?? DEMO_SOURCE,
  }));

  const sourceByName = new Map(segments.map((segment) => [segment.source.name, segment.source]));

  return {
    id,
    segments,
    oneWayFare: segments.reduce((total, segment) => total + segment.estimatedFare, 0),
    oneWayDurationMinutes: segments.reduce(
      (total, segment) => total + segment.estimatedDurationMinutes,
      0,
    ),
    transfers: countTransitTransfers(segments),
    reliability,
    sources: [...sourceByName.values()],
  };
}

export const DEMO_ROUTES: readonly CommuteRoute[] = [
  // Kept first and unchanged: this is the rehearsed CUTC hero scenario.
  buildRoute("demo-cubao-bgc", "medium", [
    {
      mode: "rail",
      from: DEMO_ORIGINS.cubao,
      to: DEMO_INTERCHANGES.ayalaMrt,
      fare: 28,
      minutes: 35,
    },
    { mode: "bus", from: DEMO_INTERCHANGES.ayalaMrt, to: DEMO_OFFICES.bgc, fare: 15, minutes: 25 },
  ]),

  buildRoute("demo-cubao-makati", "medium", [
    {
      mode: "rail",
      from: DEMO_ORIGINS.cubao,
      to: DEMO_INTERCHANGES.ayalaMrt,
      fare: 28,
      minutes: 35,
    },
    {
      mode: "walk",
      from: DEMO_INTERCHANGES.ayalaMrt,
      to: DEMO_OFFICES.makati,
      fare: 0,
      minutes: 12,
    },
  ]),

  buildRoute("demo-cubao-ortigas", "high", [
    {
      mode: "walk",
      from: DEMO_ORIGINS.cubao,
      to: DEMO_INTERCHANGES.cubaoMrt,
      fare: 0,
      minutes: 6,
    },
    {
      mode: "rail",
      from: DEMO_INTERCHANGES.cubaoMrt,
      to: DEMO_OFFICES.ortigas,
      fare: 16,
      minutes: 14,
    },
  ]),

  buildRoute("demo-fairview-bgc", "low", [
    {
      mode: "jeepney",
      from: DEMO_ORIGINS.fairview,
      to: DEMO_INTERCHANGES.fairviewTerminal,
      fare: 13,
      minutes: 12,
      provenance: ESTIMATED_SOURCE,
    },
    {
      mode: "bus",
      from: DEMO_INTERCHANGES.fairviewTerminal,
      to: DEMO_INTERCHANGES.cubaoMrt,
      fare: 45,
      minutes: 70,
      provenance: ESTIMATED_SOURCE,
    },
    {
      mode: "rail",
      from: DEMO_INTERCHANGES.cubaoMrt,
      to: DEMO_INTERCHANGES.ayalaMrt,
      fare: 28,
      minutes: 35,
    },
    { mode: "bus", from: DEMO_INTERCHANGES.ayalaMrt, to: DEMO_OFFICES.bgc, fare: 15, minutes: 25 },
  ]),

  buildRoute("demo-antipolo-bgc", "low", [
    {
      mode: "tricycle",
      from: DEMO_ORIGINS.antipolo,
      to: DEMO_INTERCHANGES.masinagJunction,
      fare: 30,
      minutes: 15,
      provenance: ESTIMATED_SOURCE,
    },
    {
      mode: "uv-express",
      from: DEMO_INTERCHANGES.masinagJunction,
      to: DEMO_INTERCHANGES.santolanLrt2,
      fare: 55,
      minutes: 45,
      provenance: ESTIMATED_SOURCE,
    },
    {
      mode: "rail",
      from: DEMO_INTERCHANGES.santolanLrt2,
      to: DEMO_INTERCHANGES.cubaoMrt,
      fare: 20,
      minutes: 12,
    },
    {
      mode: "rail",
      from: DEMO_INTERCHANGES.cubaoMrt,
      to: DEMO_INTERCHANGES.ayalaMrt,
      fare: 28,
      minutes: 35,
    },
    { mode: "bus", from: DEMO_INTERCHANGES.ayalaMrt, to: DEMO_OFFICES.bgc, fare: 15, minutes: 25 },
  ]),

  buildRoute("demo-alabang-bgc", "medium", [
    {
      mode: "jeepney",
      from: DEMO_ORIGINS.alabang,
      to: DEMO_INTERCHANGES.alabangStarmall,
      fare: 13,
      minutes: 10,
      provenance: ESTIMATED_SOURCE,
    },
    {
      mode: "p2p",
      from: DEMO_INTERCHANGES.alabangStarmall,
      to: DEMO_INTERCHANGES.mcKinleyExchange,
      fare: 100,
      minutes: 55,
      provenance: ESTIMATED_SOURCE,
    },
    {
      mode: "jeepney",
      from: DEMO_INTERCHANGES.mcKinleyExchange,
      to: DEMO_OFFICES.bgc,
      fare: 13,
      minutes: 12,
    },
  ]),

  buildRoute("demo-alabang-makati", "medium", [
    {
      mode: "jeepney",
      from: DEMO_ORIGINS.alabang,
      to: DEMO_INTERCHANGES.alabangStarmall,
      fare: 13,
      minutes: 10,
      provenance: ESTIMATED_SOURCE,
    },
    {
      mode: "bus",
      from: DEMO_INTERCHANGES.alabangStarmall,
      to: DEMO_INTERCHANGES.ayalaMrt,
      fare: 70,
      minutes: 60,
      provenance: ESTIMATED_SOURCE,
    },
    {
      mode: "walk",
      from: DEMO_INTERCHANGES.ayalaMrt,
      to: DEMO_OFFICES.makati,
      fare: 0,
      minutes: 12,
    },
  ]),

  buildRoute("demo-cainta-ortigas", "medium", [
    {
      mode: "jeepney",
      from: DEMO_ORIGINS.cainta,
      to: DEMO_INTERCHANGES.santolanLrt2,
      fare: 15,
      minutes: 25,
      provenance: ESTIMATED_SOURCE,
    },
    {
      mode: "rail",
      from: DEMO_INTERCHANGES.santolanLrt2,
      to: DEMO_OFFICES.ortigas,
      fare: 20,
      minutes: 18,
    },
  ]),

  buildRoute("demo-cainta-eastwood", "high", [
    {
      mode: "jeepney",
      from: DEMO_ORIGINS.cainta,
      to: DEMO_INTERCHANGES.santolanLrt2,
      fare: 15,
      minutes: 25,
      provenance: ESTIMATED_SOURCE,
    },
    {
      mode: "jeepney",
      from: DEMO_INTERCHANGES.santolanLrt2,
      to: DEMO_OFFICES.eastwood,
      fare: 13,
      minutes: 15,
    },
  ]),

  buildRoute("demo-monumento-makati", "medium", [
    {
      mode: "rail",
      from: DEMO_ORIGINS.monumento,
      to: DEMO_INTERCHANGES.taftLrt1,
      fare: 30,
      minutes: 40,
    },
    {
      mode: "rail",
      from: DEMO_INTERCHANGES.taftLrt1,
      to: DEMO_INTERCHANGES.ayalaMrt,
      fare: 24,
      minutes: 22,
    },
    {
      mode: "walk",
      from: DEMO_INTERCHANGES.ayalaMrt,
      to: DEMO_OFFICES.makati,
      fare: 0,
      minutes: 12,
    },
  ]),

  buildRoute("demo-monumento-bgc", "low", [
    {
      mode: "rail",
      from: DEMO_ORIGINS.monumento,
      to: DEMO_INTERCHANGES.taftLrt1,
      fare: 30,
      minutes: 40,
    },
    {
      mode: "rail",
      from: DEMO_INTERCHANGES.taftLrt1,
      to: DEMO_INTERCHANGES.ayalaMrt,
      fare: 24,
      minutes: 22,
    },
    { mode: "bus", from: DEMO_INTERCHANGES.ayalaMrt, to: DEMO_OFFICES.bgc, fare: 15, minutes: 25 },
  ]),

  buildRoute("demo-antipolo-ortigas", "medium", [
    {
      mode: "tricycle",
      from: DEMO_ORIGINS.antipolo,
      to: DEMO_INTERCHANGES.masinagJunction,
      fare: 30,
      minutes: 15,
      provenance: ESTIMATED_SOURCE,
    },
    {
      mode: "uv-express",
      from: DEMO_INTERCHANGES.masinagJunction,
      to: DEMO_INTERCHANGES.santolanLrt2,
      fare: 55,
      minutes: 45,
      provenance: ESTIMATED_SOURCE,
    },
    {
      mode: "rail",
      from: DEMO_INTERCHANGES.santolanLrt2,
      to: DEMO_OFFICES.ortigas,
      fare: 20,
      minutes: 18,
    },
  ]),
];

export { buildRoute };
