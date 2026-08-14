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
  CommuterMemoryError,
  type CommuterMemorySnapshot,
  type CommuterMemoryStorage,
  type CommuterMemoryStore,
} from "@/application/commuter-profile/store";
import { BackboardClient, BackboardError } from "./backboard-client";

/**
 * Commuter memory on Backboard.
 *
 * One Backboard assistant per anonymous commuter, because memories are scoped to
 * an assistant — that scoping is what isolates one person's profile from
 * another's without CommuteLens running an account system. The assistant id is
 * the handle.
 *
 * `forget` deletes the assistant, which removes its memories with it. That makes
 * the delete control a single call that cannot half-succeed.
 */

const ASSISTANT_NAME = "CommuteLens commuter profile";
const ASSISTANT_INSTRUCTIONS = [
  "You hold a Philippine commuter's saved planning preferences and analyzed job shortlist.",
  "Stored records are structured data written by the application, not conversation.",
].join(" ");

export interface BackboardCommuterMemoryStoreOptions {
  client?: BackboardClient;
}

export class BackboardCommuterMemoryStore implements CommuterMemoryStore {
  readonly storage: CommuterMemoryStorage = "backboard";
  private readonly client: BackboardClient;

  constructor(options: BackboardCommuterMemoryStoreOptions = {}) {
    this.client = options.client ?? new BackboardClient();
  }

  get isConfigured(): boolean {
    return this.client.isConfigured;
  }

  async createHandle(signal?: AbortSignal): Promise<string> {
    return this.guard(async () => {
      void signal;
      return this.client.createAssistant({
        name: ASSISTANT_NAME,
        systemPrompt: ASSISTANT_INSTRUCTIONS,
      });
    });
  }

  async read(handle: string, signal?: AbortSignal): Promise<CommuterMemorySnapshot> {
    assertValidHandle(handle);
    return this.guard(async () => {
      // A handle whose assistant no longer exists holds nothing. Reporting that
      // as an error would leave the browser pointing at a profile it can neither
      // read nor clear.
      const records = await this.client
        .listMemories(handle, signal)
        .catch(rethrowUnlessMissing([]));
      return {
        profile: selectProfile(records),
        offers: selectOffers(records),
        records: records.map((record) => ({ id: record.id, content: record.content })),
      };
    });
  }

  async writeProfile(
    handle: string,
    profile: CommuterProfile,
    signal?: AbortSignal,
  ): Promise<void> {
    assertValidHandle(handle);
    await this.guard(async () => {
      const existing = await this.client.listMemories(handle, signal);
      await this.client.addMemory(
        handle,
        serializeProfile(profile),
        { source: "commutelens", kind: "profile" },
        signal,
      );

      // Tidy up superseded profile records after the new one is safely written,
      // so an interrupted save leaves a duplicate rather than nothing.
      for (const record of existing.filter((entry) => isProfileRecord(entry.content))) {
        await this.client.deleteMemory(handle, record.id, signal).catch(() => {
          console.warn("Backboard: stale commuter profile record was not removed.");
        });
      }
    });
  }

  async appendOffer(handle: string, entry: OfferLedgerEntry, signal?: AbortSignal): Promise<void> {
    assertValidHandle(handle);
    await this.guard(() =>
      this.client.addMemory(
        handle,
        serializeOffer(entry),
        { source: "commutelens", kind: "offer" },
        signal,
      ),
    );
  }

  async removeOffer(handle: string, offerId: string, signal?: AbortSignal): Promise<void> {
    assertValidHandle(handle);
    await this.guard(async () => {
      const records = await this.client.listMemories(handle, signal);
      const doomed = records.filter((record) => offerIdFromRecord(record.content) === offerId);

      // An entry may have several records if it was re-analyzed, so all of its
      // records go. A record that no longer parses is left alone rather than
      // guessed at.
      for (const record of doomed) {
        await this.client
          .deleteMemory(handle, record.id, signal)
          .catch(rethrowUnlessMissing(undefined));
      }
    });
  }

  /**
   * Deletion is idempotent.
   *
   * An assistant that is already gone satisfies the request, so a 404 completes
   * normally. Treating it as a failure made the state unrecoverable: the browser
   * kept a handle it could never delete, and the saved-setup banner could never be
   * dismissed.
   */
  async forget(handle: string, signal?: AbortSignal): Promise<void> {
    assertValidHandle(handle);
    await this.guard(async () => {
      void signal;
      await this.client.deleteAssistant(handle).catch(rethrowUnlessMissing(undefined));
    });
  }

  private async guard<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof CommuterMemoryError) throw error;
      if (error instanceof BackboardError) {
        throw new CommuterMemoryError("Commuter memory is unavailable.", error.reason);
      }
      throw new CommuterMemoryError("Commuter memory is unavailable.", "upstream");
    }
  }
}

/**
 * Swallows a missing-resource error, returning `fallback` instead.
 *
 * Used only where absence is an acceptable answer: reading a profile that is gone
 * yields nothing, and deleting something already deleted is done. Every other
 * failure still propagates.
 */
function rethrowUnlessMissing<T>(fallback: T): (error: unknown) => T {
  return (error: unknown) => {
    if (error instanceof BackboardError && error.reason === "not-found") return fallback;
    throw error;
  };
}
