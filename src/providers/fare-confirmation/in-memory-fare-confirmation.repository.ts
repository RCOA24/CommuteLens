import type {
  FareConfirmationRepository,
  StoredFareConfirmationAggregate,
} from "@/application/fare-confirmation/fare-confirmation.service";

/**
 * Bounded, process-local prototype storage for fare aggregates.
 *
 * It does not retain routes, locations, reporter identifiers, or individual
 * submissions. Data disappears when the server restarts and after its TTL, so
 * a deployed product must replace this with a privacy-reviewed shared store.
 */
export class InMemoryFareConfirmationRepository implements FareConfirmationRepository {
  private readonly aggregates = new Map<string, StoredFareConfirmationAggregate>();

  constructor(private readonly maximumEntries = 2_000) {}

  get(segmentKey: string, now: number): StoredFareConfirmationAggregate | null {
    const aggregate = this.aggregates.get(segmentKey);
    if (!aggregate) return null;
    if (aggregate.expiresAt <= now) {
      this.aggregates.delete(segmentKey);
      return null;
    }
    return aggregate;
  }

  save(segmentKey: string, aggregate: StoredFareConfirmationAggregate): void {
    this.aggregates.set(segmentKey, aggregate);
    this.trimExpiredAndOldest(Date.now());
  }

  private trimExpiredAndOldest(now: number): void {
    for (const [key, aggregate] of this.aggregates) {
      if (aggregate.expiresAt <= now) this.aggregates.delete(key);
    }
    while (this.aggregates.size > this.maximumEntries) {
      const oldestKey = this.aggregates.keys().next().value;
      if (!oldestKey) return;
      this.aggregates.delete(oldestKey);
    }
  }
}
