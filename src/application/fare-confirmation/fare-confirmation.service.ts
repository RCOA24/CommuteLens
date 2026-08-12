import { appliedFareDiscountClass } from "@/domain/fare/route-pricing";
import type { CommuteRoute, FareDiscountClassName, TransportMode } from "@/domain/models";
import { commuteRouteSchema } from "@/shared/validation/domain-schemas";

/** A community-submitted typical fare is exposed only once this many entries agree. */
export const MINIMUM_CONFIRMATION_REPORTS = 5;

export type FareConfirmationStatus = "collecting" | "community-submitted";

/**
 * The display-only aggregate for one route leg. It intentionally carries no
 * locations, route ID, reporter ID, or raw report history.
 */
export interface FareConfirmationSummary {
  segmentIndex: number;
  segmentKey: string;
  mode: TransportMode;
  reportCount: number;
  typicalFare: number | null;
  reportedFareRange: { low: number; high: number } | null;
  lastConfirmedAt: string | null;
  status: FareConfirmationStatus;
}

/** A histogram is an aggregate, not a list of identifiable submissions. */
export interface StoredFareConfirmationAggregate {
  fareCounts: Readonly<Record<number, number>>;
  lastConfirmedAt: string;
  expiresAt: number;
}

export interface FareConfirmationRepository {
  get(segmentKey: string, now: number): StoredFareConfirmationAggregate | null;
  save(segmentKey: string, aggregate: StoredFareConfirmationAggregate): void;
}

export interface FareLegKeyFactory {
  create(input: {
    route: CommuteRoute;
    segmentIndex: number;
    discountClass: FareDiscountClassName;
  }): string;
}

export class FareConfirmationValidationError extends Error {}

export interface FareConfirmationServiceOptions {
  repository: FareConfirmationRepository;
  legKeyFactory: FareLegKeyFactory;
  now?: () => Date;
  expiryMs?: number;
}

const DEFAULT_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Collects privacy-preserving, per-leg fare observations.
 *
 * The authoritative estimate is deliberately never mutated here. This service
 * returns a separate overlay that is safe to display beside the calculated
 * route until a reviewed product policy elects to promote it into pricing.
 */
export class FareConfirmationService {
  private readonly now: () => Date;
  private readonly expiryMs: number;

  constructor(private readonly options: FareConfirmationServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.expiryMs = options.expiryMs ?? DEFAULT_EXPIRY_MS;
  }

  lookup(input: {
    route: CommuteRoute;
    discountClass: FareDiscountClassName;
  }): FareConfirmationSummary[] {
    const route = this.validateRouteAndEntitlement(input.route, input.discountClass);
    const now = this.now().getTime();

    return route.segments.flatMap((segment, segmentIndex) => {
      if (!isConfirmable(segment.mode, segment.estimatedFare)) return [];
      const segmentKey = this.options.legKeyFactory.create({
        route,
        segmentIndex,
        discountClass: input.discountClass,
      });
      return [
        this.toSummary(
          segmentKey,
          segmentIndex,
          segment.mode,
          this.options.repository.get(segmentKey, now),
        ),
      ];
    });
  }

  confirm(input: {
    route: CommuteRoute;
    discountClass: FareDiscountClassName;
    segmentIndex: number;
    observedFare: number;
  }): FareConfirmationSummary {
    const route = this.validateRouteAndEntitlement(input.route, input.discountClass);
    const segment = route.segments[input.segmentIndex];
    if (!segment)
      throw new FareConfirmationValidationError("Choose a valid fare-bearing route leg.");
    if (!isConfirmable(segment.mode, segment.estimatedFare)) {
      throw new FareConfirmationValidationError(
        "Walking and zero-fare legs cannot be fare-confirmed.",
      );
    }
    if (
      !Number.isFinite(input.observedFare) ||
      input.observedFare < 0 ||
      !Number.isInteger(input.observedFare)
    ) {
      throw new FareConfirmationValidationError("Enter a whole-peso fare amount.");
    }
    assertPlausibleFare(segment.mode, input.observedFare);

    const now = this.now();
    const nowMs = now.getTime();
    const segmentKey = this.options.legKeyFactory.create({
      route,
      segmentIndex: input.segmentIndex,
      discountClass: input.discountClass,
    });
    const existing = this.options.repository.get(segmentKey, nowMs);
    const existingFares = expandHistogram(existing?.fareCounts ?? {});
    if (isRobustOutlier(existingFares, input.observedFare)) {
      throw new FareConfirmationValidationError(
        "That fare is far outside the current commuter reports for this leg.",
      );
    }

    const fareCounts = { ...(existing?.fareCounts ?? {}) };
    fareCounts[input.observedFare] = (fareCounts[input.observedFare] ?? 0) + 1;
    const aggregate: StoredFareConfirmationAggregate = {
      fareCounts,
      lastConfirmedAt: now.toISOString(),
      expiresAt: nowMs + this.expiryMs,
    };
    this.options.repository.save(segmentKey, aggregate);
    return this.toSummary(segmentKey, input.segmentIndex, segment.mode, aggregate);
  }

  private validateRouteAndEntitlement(
    untrustedRoute: CommuteRoute,
    discountClass: FareDiscountClassName,
  ): CommuteRoute {
    const parsed = commuteRouteSchema.safeParse(untrustedRoute);
    if (!parsed.success)
      throw new FareConfirmationValidationError("Use a valid route before confirming a fare.");

    const appliedDiscount = appliedFareDiscountClass(parsed.data);
    if (appliedDiscount !== null && appliedDiscount !== discountClass) {
      throw new FareConfirmationValidationError(
        "Your fare class changed. Search the route again to reprice it.",
      );
    }
    if (appliedDiscount === null && discountClass !== "regular") {
      throw new FareConfirmationValidationError(
        "Your fare class changed. Search the route again to reprice it.",
      );
    }
    return parsed.data;
  }

  private toSummary(
    segmentKey: string,
    segmentIndex: number,
    mode: TransportMode,
    aggregate: StoredFareConfirmationAggregate | null,
  ): FareConfirmationSummary {
    const fares = aggregate ? expandHistogram(aggregate.fareCounts) : [];
    const reportCount = fares.length;
    const confirmed = reportCount >= MINIMUM_CONFIRMATION_REPORTS;

    return {
      segmentIndex,
      segmentKey,
      mode,
      reportCount,
      typicalFare: confirmed ? median(fares) : null,
      reportedFareRange:
        confirmed && fares.length > 0
          ? { low: Math.min(...fares), high: Math.max(...fares) }
          : null,
      lastConfirmedAt: confirmed ? (aggregate?.lastConfirmedAt ?? null) : null,
      status: confirmed ? "community-submitted" : "collecting",
    };
  }
}

function isConfirmable(mode: TransportMode, estimatedFare: number): boolean {
  return mode !== "walk" && estimatedFare > 0;
}

const FARE_BOUNDS: Readonly<Record<Exclude<TransportMode, "walk">, { min: number; max: number }>> =
  {
    jeepney: { min: 8, max: 200 },
    bus: { min: 10, max: 500 },
    rail: { min: 10, max: 500 },
    "uv-express": { min: 20, max: 600 },
    p2p: { min: 20, max: 1_000 },
    tricycle: { min: 10, max: 500 },
    other: { min: 1, max: 1_000 },
  };

function assertPlausibleFare(mode: TransportMode, fare: number): void {
  if (mode === "walk")
    throw new FareConfirmationValidationError("Walking legs do not have a fare.");
  const bounds = FARE_BOUNDS[mode];
  if (fare < bounds.min || fare > bounds.max) {
    throw new FareConfirmationValidationError(
      `Enter a plausible ${mode.replace("-", " ")} fare between ₱${bounds.min} and ₱${bounds.max}.`,
    );
  }
}

function expandHistogram(fareCounts: Readonly<Record<number, number>>): number[] {
  return Object.entries(fareCounts).flatMap(([fare, count]) =>
    Array.from({ length: count }, () => Number(fare)),
  );
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

/** Reject only obvious disagreement once enough local context exists. */
function isRobustOutlier(existingFares: readonly number[], candidate: number): boolean {
  if (existingFares.length < 3) return false;
  const currentMedian = median(existingFares);
  const deviations = existingFares.map((fare) => Math.abs(fare - currentMedian));
  const mad = median(deviations);
  const permittedDeviation = mad === 0 ? Math.max(5, currentMedian * 0.25) : Math.max(5, mad * 3);
  return Math.abs(candidate - currentMedian) > permittedDeviation;
}
