import { DEMO_ROUTES } from "@/data/demo";
import type { CommuteRoute, Coordinate } from "@/domain/models";
import { TtlCache } from "@/shared/cache/ttl-cache";
import { distanceKm } from "@/shared/geo/distance";
import { commuteRouteSchema } from "@/shared/validation/domain-schemas";
import type { TransitProvider, TransitRouteRequest, TransitRouteResult } from "./transit-provider";

/**
 * CL-006 — curated demo transit provider.
 *
 * Matching is proximity-based rather than exact-coordinate: a real user will
 * geocode to somewhere near a curated origin, not onto it. Origins get a wider
 * radius than offices because "where I live" is fuzzier than "which CBD".
 *
 * This provider never calculates commute burden or effective compensation. It
 * returns normalized `CommuteRoute[]` and nothing else.
 */

export interface MockTransitProviderOptions {
  /** How far a request origin may sit from a curated origin, in km. */
  originRadiusKm?: number;
  /** How far a request destination may sit from a curated office, in km. */
  destinationRadiusKm?: number;
  /** Cache lifetime for repeated identical lookups. */
  cacheTtlMs?: number;
  /** Injected for tests. */
  routes?: readonly CommuteRoute[];
}

const DEFAULT_ORIGIN_RADIUS_KM = 6;
// Kept tight on purpose: BGC and Makati CBD are ~2.8 km apart, so a wider
// radius would offer a Makati route for a BGC office.
const DEFAULT_DESTINATION_RADIUS_KM = 2;
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

/** Coarse cache key. Rounding to ~1 km avoids caching precise coordinates. */
function cacheKey(origin: Coordinate, destination: Coordinate): string {
  const round = (value: number) => value.toFixed(2);
  return [
    round(origin.latitude),
    round(origin.longitude),
    round(destination.latitude),
    round(destination.longitude),
  ].join("|");
}

function routeEndpoints(
  route: CommuteRoute,
): { origin: Coordinate; destination: Coordinate } | null {
  const origin = route.segments[0]?.origin.coordinate;
  const destination = route.segments.at(-1)?.destination.coordinate;
  return origin && destination ? { origin, destination } : null;
}

export class MockTransitProvider implements TransitProvider {
  private readonly originRadiusKm: number;
  private readonly destinationRadiusKm: number;
  private readonly routes: readonly CommuteRoute[];
  private readonly cache: TtlCache<CommuteRoute[]>;

  constructor(options: MockTransitProviderOptions = {}) {
    this.originRadiusKm = options.originRadiusKm ?? DEFAULT_ORIGIN_RADIUS_KM;
    this.destinationRadiusKm = options.destinationRadiusKm ?? DEFAULT_DESTINATION_RADIUS_KM;
    this.routes = options.routes ?? DEMO_ROUTES;
    this.cache = new TtlCache<CommuteRoute[]>(options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS);
  }

  async findRoutes(request: TransitRouteRequest): Promise<TransitRouteResult> {
    const requestOrigin = request.origin.coordinate;
    const requestDestination = request.destination.coordinate;
    const key = cacheKey(requestOrigin, requestDestination);

    const cached = this.cache.get(key);
    if (cached) {
      return cached.length > 0
        ? { status: "success", routes: cached }
        : { status: "unsupported", routes: [], ...UNSUPPORTED_MESSAGE };
    }

    const matches = this.routes
      .flatMap((route) => {
        const endpoints = routeEndpoints(route);
        if (!endpoints) return [];

        const originDistanceKm = distanceKm(endpoints.origin, requestOrigin);
        const destinationDistanceKm = distanceKm(endpoints.destination, requestDestination);
        if (
          originDistanceKm > this.originRadiusKm ||
          destinationDistanceKm > this.destinationRadiusKm
        ) {
          return [];
        }

        return [{ route, detourKm: originDistanceKm + destinationDistanceKm }];
      })
      // Closest curated corridor first, then cheapest, then fastest. Ties broken
      // by id so the demo is reproducible.
      .sort(
        (left, right) =>
          left.detourKm - right.detourKm ||
          left.route.oneWayFare - right.route.oneWayFare ||
          left.route.oneWayDurationMinutes - right.route.oneWayDurationMinutes ||
          left.route.id.localeCompare(right.route.id),
      );

    const normalized: CommuteRoute[] = [];
    for (const match of matches) {
      // Normalize at the provider boundary so malformed curated data never
      // reaches the calculation engines.
      const parsed = commuteRouteSchema.safeParse(match.route);
      if (parsed.success) normalized.push(parsed.data);
    }

    if (matches.length > 0 && normalized.length === 0) {
      // Curated data exists for this corridor but failed its own invariants.
      // Surface it as a provider fault, not as "no route".
      return {
        status: "unavailable",
        routes: [],
        message: "The transit provider returned data that failed validation.",
      };
    }

    this.cache.set(key, normalized);

    return normalized.length > 0
      ? { status: "success", routes: normalized }
      : { status: "unsupported", routes: [], ...UNSUPPORTED_MESSAGE };
  }
}

const UNSUPPORTED_MESSAGE = {
  message:
    "This route is outside the curated Metro Manila demo coverage. Pick a supported demo origin and office.",
} as const;
