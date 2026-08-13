import { applyFareDiscount, priceLeg } from "@/domain/fare";
import { countTransitTransfers } from "@/domain/commute/route-metrics";
import type { CommuteRoute, CommuteSegment, DataSource, Location } from "@/domain/models";
import { distanceKm } from "@/shared/geo/distance";
import { commuteRouteSchema } from "@/shared/validation/domain-schemas";
import {
  loadStaticGtfsIndex,
  type StaticGtfsFeedConfig,
  type StaticGtfsIndex,
  type StaticGtfsStop,
  type StaticGtfsTrip,
} from "./static-gtfs-data";
import type { TransitProvider, TransitRouteRequest, TransitRouteResult } from "./transit-provider";

const DEFAULT_FEED: StaticGtfsFeedConfig = {
  id: "mdb-1106",
  name: "DOTC/Sakay Metro Manila GTFS",
  zipUrl: "https://github.com/sakayph/gtfs/archive/refs/heads/master.zip",
  catalogUrl: "https://mobilitydatabase.org/feeds/gtfs/mdb-1106",
  effectiveThrough: "2020-06-30",
};

const DEFAULT_STOP_RADIUS_KM = 1.25;
const NEARBY_STOP_LIMIT = 8;
const MAX_DIRECT_PATTERNS = 24;
const MAX_TRANSFER_PATTERNS = 24;
const WALKING_SPEED_KMH = 4.5;
const TRANSFER_WAIT_MINUTES = 10;

interface NearbyStop {
  stop: StaticGtfsStop;
  distanceKm: number;
}

interface GtfsLeg {
  trip: StaticGtfsTrip;
  fromIndex: number;
  toIndex: number;
  extraMinutes: number;
}

interface GtfsPath {
  legs: GtfsLeg[];
  access: NearbyStop;
  egress: NearbyStop;
}

export interface StaticGtfsTransitProviderOptions {
  feed?: Partial<StaticGtfsFeedConfig>;
  fetchImpl?: typeof fetch;
  stopRadiusKm?: number;
}

function feedFromEnvironment(overrides: Partial<StaticGtfsFeedConfig> = {}): StaticGtfsFeedConfig {
  return {
    ...DEFAULT_FEED,
    ...(process.env.OPEN_GTFS_URL?.trim() ? { zipUrl: process.env.OPEN_GTFS_URL.trim() } : {}),
    ...overrides,
  };
}

function positiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function walkingMinutes(kilometres: number): number {
  if (kilometres < 0.01) return 0;
  return Math.max(1, Math.round((kilometres / WALKING_SPEED_KMH) * 60));
}

function transitMinutes(leg: GtfsLeg): number | null {
  const from = leg.trip.stops[leg.fromIndex];
  const to = leg.trip.stops[leg.toIndex];
  if (!from || !to) return null;
  const seconds = to.arrivalSeconds - from.departureSeconds;
  return seconds > 0 ? Math.max(1, Math.round(seconds / 60) + leg.extraMinutes) : null;
}

function nearestStops(
  index: StaticGtfsIndex,
  location: Location,
  radiusKm: number,
): NearbyStop[] {
  return [...index.stops.values()]
    .map((stop) => ({ stop, distanceKm: distanceKm(location.coordinate, stop.location.coordinate) }))
    .filter((candidate) => candidate.distanceKm <= radiusKm)
    .sort((left, right) => left.distanceKm - right.distanceKm)
    .slice(0, NEARBY_STOP_LIMIT);
}

function findDestinationIndex(
  trip: StaticGtfsTrip,
  afterIndex: number,
  destinationStopIds: ReadonlySet<string>,
): number | null {
  for (let index = afterIndex + 1; index < trip.stops.length; index += 1) {
    if (destinationStopIds.has(trip.stops[index].stopId)) return index;
  }
  return null;
}

function pathKey(path: GtfsPath): string {
  return path.legs
    .map((leg) => {
      const from = leg.trip.stops[leg.fromIndex]?.stopId;
      const to = leg.trip.stops[leg.toIndex]?.stopId;
      return `${leg.trip.route.id}:${from}:${to}`;
    })
    .join("|");
}

function pathMinutes(path: GtfsPath): number {
  return (
    walkingMinutes(path.access.distanceKm) +
    walkingMinutes(path.egress.distanceKm) +
    path.legs.reduce((sum, leg) => sum + (transitMinutes(leg) ?? Number.MAX_SAFE_INTEGER), 0)
  );
}

function retainBestPath(paths: Map<string, GtfsPath>, candidate: GtfsPath): void {
  if (candidate.legs.some((leg) => transitMinutes(leg) === null)) return;
  const key = pathKey(candidate);
  const current = paths.get(key);
  if (!current || pathMinutes(candidate) < pathMinutes(current)) paths.set(key, candidate);
}

function directPaths(
  index: StaticGtfsIndex,
  origins: NearbyStop[],
  destinations: NearbyStop[],
): GtfsPath[] {
  const destinationById = new Map(destinations.map((candidate) => [candidate.stop.id, candidate]));
  const destinationIds = new Set(destinationById.keys());
  const paths = new Map<string, GtfsPath>();

  for (const access of origins) {
    const occurrences = index.occurrencesByStop.get(access.stop.id) ?? [];
    for (const occurrence of occurrences.slice(0, 120)) {
      const trip = index.trips.get(occurrence.tripId);
      if (!trip) continue;
      const destinationIndex = findDestinationIndex(trip, occurrence.index, destinationIds);
      if (destinationIndex === null) continue;
      const egress = destinationById.get(trip.stops[destinationIndex].stopId);
      if (!egress) continue;
      retainBestPath(paths, {
        access,
        egress,
        legs: [{ trip, fromIndex: occurrence.index, toIndex: destinationIndex, extraMinutes: 0 }],
      });
      if (paths.size >= MAX_DIRECT_PATTERNS) break;
    }
  }

  return [...paths.values()];
}

function transferPaths(
  index: StaticGtfsIndex,
  origins: NearbyStop[],
  destinations: NearbyStop[],
): GtfsPath[] {
  const destinationById = new Map(destinations.map((candidate) => [candidate.stop.id, candidate]));
  const destinationIds = new Set(destinationById.keys());
  const paths = new Map<string, GtfsPath>();

  for (const access of origins) {
    const firstOccurrences = index.occurrencesByStop.get(access.stop.id) ?? [];
    for (const firstOccurrence of firstOccurrences.slice(0, 80)) {
      const firstTrip = index.trips.get(firstOccurrence.tripId);
      if (!firstTrip) continue;
      const lastTransferIndex = Math.min(firstTrip.stops.length - 2, firstOccurrence.index + 35);

      for (
        let transferIndex = firstOccurrence.index + 1;
        transferIndex <= lastTransferIndex;
        transferIndex += 1
      ) {
        const transferStopId = firstTrip.stops[transferIndex].stopId;
        const secondOccurrences = index.occurrencesByStop.get(transferStopId) ?? [];
        for (const secondOccurrence of secondOccurrences.slice(0, 50)) {
          if (secondOccurrence.tripId === firstTrip.id) continue;
          const secondTrip = index.trips.get(secondOccurrence.tripId);
          if (!secondTrip || secondTrip.route.id === firstTrip.route.id) continue;
          const destinationIndex = findDestinationIndex(
            secondTrip,
            secondOccurrence.index,
            destinationIds,
          );
          if (destinationIndex === null) continue;
          const egress = destinationById.get(secondTrip.stops[destinationIndex].stopId);
          if (!egress) continue;
          retainBestPath(paths, {
            access,
            egress,
            legs: [
              {
                trip: firstTrip,
                fromIndex: firstOccurrence.index,
                toIndex: transferIndex,
                extraMinutes: 0,
              },
              {
                trip: secondTrip,
                fromIndex: secondOccurrence.index,
                toIndex: destinationIndex,
                extraMinutes: TRANSFER_WAIT_MINUTES,
              },
            ],
          });
          if (paths.size >= MAX_TRANSFER_PATTERNS) return [...paths.values()];
        }
      }
    }
  }

  return [...paths.values()];
}

function stableHash(value: string): string {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function routeSource(index: StaticGtfsIndex, routeName?: string): DataSource {
  return {
    type: "gtfs",
    name: routeName ? `${index.feed.name} — ${routeName}` : index.feed.name,
    sourceUrl: index.feed.catalogUrl,
    retrievedAt: index.loadedAt,
    ...(index.feed.effectiveThrough ? { effectiveDate: index.feed.effectiveThrough } : {}),
    confidence: "low",
    freshness: "archival",
  };
}

const WALK_SOURCE: DataSource = {
  type: "estimated",
  name: "Commute Lens walking-access estimate",
  confidence: "low",
};

function appendWalk(
  segments: CommuteSegment[],
  origin: Location,
  destination: Location,
  kilometres: number,
): void {
  const minutes = walkingMinutes(kilometres);
  if (minutes === 0) return;
  segments.push({
    mode: "walk",
    origin,
    destination,
    estimatedFare: 0,
    estimatedDurationMinutes: minutes,
    source: WALK_SOURCE,
  });
}

function toCommuteRoute(
  index: StaticGtfsIndex,
  path: GtfsPath,
  request: TransitRouteRequest,
): CommuteRoute | null {
  const segments: CommuteSegment[] = [];
  const sources = new Map<string, DataSource>();
  appendWalk(segments, request.origin, path.access.stop.location, path.access.distanceKm);
  if (segments.length > 0) sources.set(WALK_SOURCE.name, WALK_SOURCE);

  for (const leg of path.legs) {
    const fromTime = leg.trip.stops[leg.fromIndex];
    const toTime = leg.trip.stops[leg.toIndex];
    const origin = index.stops.get(fromTime.stopId)?.location;
    const destination = index.stops.get(toTime.stopId)?.location;
    const minutes = transitMinutes(leg);
    if (!origin || !destination || minutes === null) return null;

    const source = routeSource(index, leg.trip.route.name);
    const priced = priceLeg({
      mode: leg.trip.route.mode,
      from: origin.coordinate,
      to: destination.coordinate,
    });
    sources.set(source.name, source);
    if (priced.source) sources.set(priced.source.name, priced.source);
    segments.push({
      mode: leg.trip.route.mode,
      origin,
      destination,
      estimatedFare: priced.fare,
      estimatedDurationMinutes: minutes,
      source,
    });
  }

  appendWalk(segments, path.egress.stop.location, request.destination, path.egress.distanceKm);
  if (path.egress.distanceKm >= 0.01) sources.set(WALK_SOURCE.name, WALK_SOURCE);
  if (segments.length === 0) return null;

  const candidate: CommuteRoute = {
    id: `open-gtfs-${index.feed.id}-${stableHash(pathKey(path))}`,
    segments,
    oneWayFare: segments.reduce((sum, segment) => sum + segment.estimatedFare, 0),
    oneWayDurationMinutes: segments.reduce(
      (sum, segment) => sum + segment.estimatedDurationMinutes,
      0,
    ),
    transfers: countTransitTransfers(segments),
    reliability: "low",
    sources: [...sources.values()],
  };
  const entitled = applyFareDiscount(candidate, request.discountClass ?? "regular");
  const parsed = commuteRouteSchema.safeParse(entitled);
  return parsed.success ? parsed.data : null;
}

/**
 * Routes through published DOTC/Sakay GTFS topology when live routing has no
 * coverage. The source calendar is archival, so results are always labelled as
 * route patterns with estimated timing—not as current schedules or live service.
 */
export class StaticGtfsTransitProvider implements TransitProvider {
  private readonly feed: StaticGtfsFeedConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly stopRadiusKm: number;
  private indexPromise: Promise<StaticGtfsIndex> | null = null;

  constructor(options: StaticGtfsTransitProviderOptions = {}) {
    this.feed = feedFromEnvironment(options.feed);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.stopRadiusKm = positiveNumber(options.stopRadiusKm, DEFAULT_STOP_RADIUS_KM);
  }

  async findRoutes(request: TransitRouteRequest): Promise<TransitRouteResult> {
    let index: StaticGtfsIndex;
    try {
      this.indexPromise ??= loadStaticGtfsIndex(this.feed, this.fetchImpl);
      index = await this.indexPromise;
    } catch {
      this.indexPromise = null;
      return {
        status: "unavailable",
        routes: [],
        message: "The open transit dataset is temporarily unavailable.",
      };
    }

    const origins = nearestStops(index, request.origin, this.stopRadiusKm);
    const destinations = nearestStops(index, request.destination, this.stopRadiusKm);
    if (origins.length === 0 || destinations.length === 0) {
      return {
        status: "unsupported",
        routes: [],
        message: "No published Metro Manila stops were found near this commute.",
      };
    }

    const paths = [...directPaths(index, origins, destinations)];
    if (paths.length < 3) paths.push(...transferPaths(index, origins, destinations));
    const routes = paths
      .sort((left, right) => pathMinutes(left) - pathMinutes(right))
      .map((path) => toCommuteRoute(index, path, request))
      .filter((route): route is CommuteRoute => route !== null)
      .slice(0, 3);

    return routes.length > 0
      ? { status: "success", routes }
      : {
          status: "unsupported",
          routes: [],
          message: "No usable published route pattern was found for this commute.",
        };
  }
}
