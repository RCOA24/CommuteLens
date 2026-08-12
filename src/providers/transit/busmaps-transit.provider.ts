import { countTransitTransfers } from "@/domain/commute/route-metrics";
import { applyFareDiscount, priceLeg } from "@/domain/fare";
import type {
  CommuteRoute,
  CommuteSegment,
  DataSource,
  Location,
  TransportMode,
} from "@/domain/models";
import { commuteRouteSchema } from "@/shared/validation/domain-schemas";
import type { TransitProvider, TransitRouteRequest, TransitRouteResult } from "./transit-provider";

const DEFAULT_BASE_URL = "https://capi.busmaps.com:8443";
const REQUEST_TIMEOUT_MS = 8_000;
type BusMapsMode = "bus" | "subway" | "train" | "tram" | "pedestrian";
interface BusMapsPlace {
  name?: unknown;
  location?: { lat?: unknown; lng?: unknown };
}
interface BusMapsSection {
  travelSummary?: { duration?: unknown };
  departure?: { place?: BusMapsPlace };
  arrival?: { place?: BusMapsPlace };
  transport?: { mode?: unknown };
}
interface BusMapsRoute {
  id?: unknown;
  sections?: unknown;
}
interface BusMapsRoutesResponse {
  routes?: unknown;
}

/**
 * BusMaps returns live routing and timing but no fare quote, so fares come from
 * the shared fare matrix, priced per leg from that leg's own distance.
 *
 * This replaces a flat per-mode table that had two serious defects: it charged
 * the same fare for a two-station hop as for an end-to-end ride, and it returned
 * ₱0 for any mode outside its list. Since BusMaps only ever emits
 * bus/subway/train/tram/pedestrian, everything else fell through to zero — which
 * meant jeepney-class legs, the most common way Filipinos actually travel, were
 * silently reported as free.
 */
function transportMode(mode: unknown): TransportMode {
  if (mode === "subway" || mode === "train" || mode === "tram") return "rail";
  if (mode === "bus") return "bus";
  if (mode === "pedestrian") return "walk";
  // Deliberately `other`, which the fare matrix prices as unclassified surface
  // transport at the jeepney band. Never free.
  return "other";
}
function toLocation(place: BusMapsPlace | undefined, fallback: Location): Location {
  const lat = place?.location?.lat;
  const lng = place?.location?.lng;
  const label =
    typeof place?.name === "string" && place.name.trim() ? place.name.trim() : fallback.label;
  return typeof lat === "number" && typeof lng === "number"
    ? { label, coordinate: { latitude: lat, longitude: lng } }
    : { ...fallback, label };
}

export class BusMapsTransitProvider implements TransitProvider {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  constructor(options: { apiKey?: string; baseUrl?: string; fetchImpl?: typeof fetch } = {}) {
    this.apiKey = options.apiKey ?? process.env.BUSMAPS_API_KEY;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }
  async findRoutes(request: TransitRouteRequest): Promise<TransitRouteResult> {
    if (!this.apiKey?.trim())
      return { status: "unavailable", routes: [], message: "BusMaps is not configured." };
    const url = new URL(`${this.baseUrl}/routes`);
    url.searchParams.set("origin", coordinateParam(request.origin));
    url.searchParams.set("destination", coordinateParam(request.destination));
    url.searchParams.set("maxRoutes", "3");
    url.searchParams.set("lang", "en");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(url, {
        signal: controller.signal,
        headers: {
          "capi-key": `Bearer ${this.apiKey}`,
          "capi-host": "busmaps.com",
          Accept: "application/json",
        },
      });
      if (response.status === 400 || response.status === 404)
        return {
          status: "unsupported",
          routes: [],
          message: "No live BusMaps route was found for this commute.",
        };
      if (!response.ok)
        return {
          status: "unavailable",
          routes: [],
          message: "BusMaps is temporarily unavailable.",
        };
      const payload = (await response.json()) as BusMapsRoutesResponse;
      const routes = Array.isArray(payload.routes)
        ? payload.routes
            .map((route, index) => this.toCommuteRoute(route as BusMapsRoute, request, index))
            .filter((route): route is CommuteRoute => route !== null)
        : [];
      return routes.length
        ? { status: "success", routes }
        : {
            status: "unsupported",
            routes: [],
            message: "BusMaps returned no usable transit route.",
          };
    } catch {
      return { status: "unavailable", routes: [], message: "BusMaps could not be reached." };
    } finally {
      clearTimeout(timeout);
    }
  }
  private toCommuteRoute(
    route: BusMapsRoute,
    request: TransitRouteRequest,
    index: number,
  ): CommuteRoute | null {
    if (!Array.isArray(route.sections)) return null;
    const busMapsSource: DataSource = {
      type: "gtfs",
      name: "BusMaps live transit routing",
      sourceUrl: "https://busmaps.com/en/developers/api-docs/routes",
      retrievedAt: new Date().toISOString(),
      confidence: "medium",
    };
    const sections = route.sections as BusMapsSection[];
    const legs = sections.flatMap((section) => {
      const seconds = section.travelSummary?.duration;
      if (typeof seconds !== "number" || seconds < 0) return [];
      return [
        {
          mode: transportMode(section.transport?.mode),
          origin: toLocation(section.departure?.place, request.origin),
          destination: toLocation(section.arrival?.place, request.destination),
          minutes: Math.max(1, Math.round(seconds / 60)),
        },
      ];
    });
    if (!legs.length) return null;

    // Snap the ends to what the user actually chose before pricing, so each
    // leg's fare reflects the distance we will draw on the map.
    legs[0].origin = request.origin;
    legs[legs.length - 1].destination = request.destination;

    const fareSources = new Map<string, DataSource>();
    const segments: CommuteSegment[] = legs.map((leg) => {
      // Priced at full published fare on purpose. The statutory discount is a
      // route-level transform applied once, above every provider, so pricing it
      // here as well would discount the leg twice.
      const priced = priceLeg({
        mode: leg.mode,
        from: leg.origin.coordinate,
        to: leg.destination.coordinate,
      });
      if (priced.source) fareSources.set(priced.source.name, priced.source);
      return {
        mode: leg.mode,
        origin: leg.origin,
        destination: leg.destination,
        estimatedFare: priced.fare,
        estimatedDurationMinutes: leg.minutes,
        // Walking legs have no fare, so they keep the routing provenance rather
        // than borrowing a fare source they never contributed to.
        source: priced.source ?? busMapsSource,
      };
    });

    const candidate: CommuteRoute = {
      id: `busmaps-${typeof route.id === "string" ? route.id : index}`,
      segments,
      oneWayFare: segments.reduce((total, segment) => total + segment.estimatedFare, 0),
      oneWayDurationMinutes: segments.reduce(
        (total, segment) => total + segment.estimatedDurationMinutes,
        0,
      ),
      transfers: countTransitTransfers(segments),
      reliability: "medium",
      sources: [busMapsSource, ...fareSources.values()],
    };
    // Honouring the passenger's statutory entitlement is part of the provider
    // contract, applied once here to the fully priced route.
    const entitled = applyFareDiscount(candidate, request.discountClass ?? "regular");
    const parsed = commuteRouteSchema.safeParse(entitled);
    return parsed.success ? parsed.data : null;
  }
}
function coordinateParam(location: Location) {
  return `${location.coordinate.latitude},${location.coordinate.longitude}`;
}
export function toBusMapsMode(mode: TransportMode): BusMapsMode | null {
  if (mode === "walk") return "pedestrian";
  if (mode === "rail") return "train";
  if (mode === "bus") return "bus";
  return null;
}
