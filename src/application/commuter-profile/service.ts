import type { CommuterMemoryRecord, CommuterProfile, OfferLedgerEntry } from "./memory";
import {
  CommuterMemoryError,
  type CommuterMemoryFailureReason,
  type CommuterMemoryStorage,
  type CommuterMemoryStore,
} from "./store";

/**
 * Commuter memory service.
 *
 * Recall is an enhancement: if it fails, the user types the form as they always
 * did, so every read path degrades instead of throwing.
 *
 * Deletion is not an enhancement. `forget` reports success or failure honestly,
 * because a "forgotten" message over a failed delete would be a lie about data
 * retention — the one thing a memory feature must never get wrong.
 */

export interface CommuterMemorySnapshotResult {
  storage: CommuterMemoryStorage | "none";
  profile: CommuterProfile | null;
  offers: OfferLedgerEntry[];
  records: CommuterMemoryRecord[];
  degradedReason?: CommuterMemoryFailureReason;
}

export interface CommuterHandleResult {
  handle: string | null;
  storage: CommuterMemoryStorage | "none";
  degradedReason?: CommuterMemoryFailureReason;
}

export interface CommuterForgetResult {
  forgotten: boolean;
  storage: CommuterMemoryStorage | "none";
  failureReason?: CommuterMemoryFailureReason;
}

const EMPTY: Omit<CommuterMemorySnapshotResult, "storage" | "degradedReason"> = {
  profile: null,
  offers: [],
  records: [],
};

export class CommuterMemoryService {
  constructor(private readonly store: CommuterMemoryStore | null) {}

  get storage(): CommuterMemoryStorage | "none" {
    return this.store?.isConfigured ? this.store.storage : "none";
  }

  async createHandle(signal?: AbortSignal): Promise<CommuterHandleResult> {
    if (!this.store?.isConfigured) {
      return { handle: null, storage: "none", degradedReason: "not-configured" };
    }
    try {
      return { handle: await this.store.createHandle(signal), storage: this.store.storage };
    } catch (error) {
      return { handle: null, storage: this.store.storage, degradedReason: reasonOf(error) };
    }
  }

  async recall(handle: string, signal?: AbortSignal): Promise<CommuterMemorySnapshotResult> {
    if (!this.store?.isConfigured) {
      return { ...EMPTY, storage: "none", degradedReason: "not-configured" };
    }
    try {
      return { ...(await this.store.read(handle, signal)), storage: this.store.storage };
    } catch (error) {
      return { ...EMPTY, storage: this.store.storage, degradedReason: reasonOf(error) };
    }
  }

  async remember(
    handle: string,
    profile: CommuterProfile,
    signal?: AbortSignal,
  ): Promise<CommuterMemorySnapshotResult> {
    if (!this.store?.isConfigured) {
      return { ...EMPTY, storage: "none", degradedReason: "not-configured" };
    }
    try {
      await this.store.writeProfile(handle, profile, signal);
    } catch (error) {
      return { ...EMPTY, storage: this.store.storage, degradedReason: reasonOf(error) };
    }
    return this.recall(handle, signal);
  }

  async rememberOffer(
    handle: string,
    entry: OfferLedgerEntry,
    signal?: AbortSignal,
  ): Promise<CommuterMemorySnapshotResult> {
    if (!this.store?.isConfigured) {
      return { ...EMPTY, storage: "none", degradedReason: "not-configured" };
    }
    try {
      await this.store.appendOffer(handle, entry, signal);
    } catch (error) {
      return { ...EMPTY, storage: this.store.storage, degradedReason: reasonOf(error) };
    }
    return this.recall(handle, signal);
  }

  /**
   * Removes one shortlist entry.
   *
   * Deletion is reported honestly like `forget`: the snapshot that comes back is
   * read from storage after the delete, so a UI can never show an entry as gone
   * while it is still stored.
   */
  async forgetOffer(
    handle: string,
    offerId: string,
    signal?: AbortSignal,
  ): Promise<CommuterMemorySnapshotResult> {
    if (!this.store?.isConfigured) {
      return { ...EMPTY, storage: "none", degradedReason: "not-configured" };
    }
    try {
      await this.store.removeOffer(handle, offerId, signal);
    } catch (error) {
      return { ...EMPTY, storage: this.store.storage, degradedReason: reasonOf(error) };
    }
    return this.recall(handle, signal);
  }

  async forget(handle: string, signal?: AbortSignal): Promise<CommuterForgetResult> {
    if (!this.store?.isConfigured) {
      // Nothing was ever stored, so the user's intent is already satisfied.
      return { forgotten: true, storage: "none" };
    }
    try {
      await this.store.forget(handle, signal);
      return { forgotten: true, storage: this.store.storage };
    } catch (error) {
      return { forgotten: false, storage: this.store.storage, failureReason: reasonOf(error) };
    }
  }
}

function reasonOf(error: unknown): CommuterMemoryFailureReason {
  return error instanceof CommuterMemoryError ? error.reason : "upstream";
}
