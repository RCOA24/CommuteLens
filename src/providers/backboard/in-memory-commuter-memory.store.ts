import { randomUUID } from "node:crypto";
import {
  isProfileRecord,
  offerIdFromRecord,
  selectOffers,
  selectProfile,
  serializeOffer,
  serializeProfile,
  type CommuterProfile,
  type OfferLedgerEntry,
} from "@/application/commuter-profile/memory";
import {
  assertValidHandle,
  type CommuterMemorySnapshot,
  type CommuterMemoryStorage,
  type CommuterMemoryStore,
} from "@/application/commuter-profile/store";

/**
 * Process-local commuter memory.
 *
 * Used for tests and for a rehearsal without a Backboard key. It reports
 * `session-only` storage so the UI never claims a value survives a restart when
 * it does not — the same honesty rule the fare-confirmation repository follows.
 */
export class InMemoryCommuterMemoryStore implements CommuterMemoryStore {
  readonly storage: CommuterMemoryStorage = "session-only";
  private readonly records = new Map<string, { id: string; content: string }[]>();
  private sequence = 0;

  get isConfigured(): boolean {
    return true;
  }

  async createHandle(): Promise<string> {
    const handle = randomUUID();
    this.records.set(handle, []);
    return handle;
  }

  async read(handle: string): Promise<CommuterMemorySnapshot> {
    assertValidHandle(handle);
    const records = this.records.get(handle) ?? [];
    return {
      profile: selectProfile(records),
      offers: selectOffers(records),
      records: records.map((record) => ({ ...record })),
    };
  }

  async writeProfile(handle: string, profile: CommuterProfile): Promise<void> {
    assertValidHandle(handle);
    const existing = (this.records.get(handle) ?? []).filter(
      (record) => !isProfileRecord(record.content),
    );
    this.records.set(handle, [
      ...existing,
      { id: `memory-${++this.sequence}`, content: serializeProfile(profile) },
    ]);
  }

  async appendOffer(handle: string, entry: OfferLedgerEntry): Promise<void> {
    assertValidHandle(handle);
    const existing = this.records.get(handle) ?? [];
    this.records.set(handle, [
      ...existing,
      { id: `memory-${++this.sequence}`, content: serializeOffer(entry) },
    ]);
  }

  async removeOffer(handle: string, offerId: string): Promise<void> {
    assertValidHandle(handle);
    const existing = this.records.get(handle) ?? [];
    this.records.set(
      handle,
      existing.filter((record) => offerIdFromRecord(record.content) !== offerId),
    );
  }

  async forget(handle: string): Promise<void> {
    assertValidHandle(handle);
    this.records.delete(handle);
  }
}
