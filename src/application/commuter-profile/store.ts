import type { CommuterMemoryRecord, CommuterProfile, OfferLedgerEntry } from "./memory";

/**
 * Commuter memory port.
 *
 * A *handle* is an opaque, unguessable identifier the browser keeps in local
 * storage. It is the whole of the authorization model: there are no accounts, so
 * possession of the handle is possession of the profile. That is an accepted
 * hackathon-scope tradeoff, and it is why handles are validated as UUIDs before
 * they are ever interpolated into a provider URL, and why nothing sensitive
 * enough to matter is stored behind one.
 *
 * `storage` is reported to the client so the UI can say where a value lives
 * instead of implying durability it does not have.
 */

export type CommuterMemoryStorage = "backboard" | "session-only";

export interface CommuterMemorySnapshot {
  profile: CommuterProfile | null;
  offers: OfferLedgerEntry[];
  /** Verbatim stored records, so the UI can show exactly what is retained. */
  records: CommuterMemoryRecord[];
}

export interface CommuterMemoryStore {
  readonly storage: CommuterMemoryStorage;
  get isConfigured(): boolean;
  createHandle(signal?: AbortSignal): Promise<string>;
  read(handle: string, signal?: AbortSignal): Promise<CommuterMemorySnapshot>;
  writeProfile(handle: string, profile: CommuterProfile, signal?: AbortSignal): Promise<void>;
  appendOffer(handle: string, entry: OfferLedgerEntry, signal?: AbortSignal): Promise<void>;
  /** Removes one shortlist entry, leaving the profile and other entries intact. */
  removeOffer(handle: string, offerId: string, signal?: AbortSignal): Promise<void>;
  /** Removes everything held behind the handle. Must succeed or throw — never partial-silent. */
  forget(handle: string, signal?: AbortSignal): Promise<void>;
}

export type CommuterMemoryFailureReason =
  | "not-configured"
  | "invalid-handle"
  /** The stored file is gone. A browser holding its handle should discard it. */
  | "not-found"
  | "timeout"
  | "upstream"
  | "unauthorized"
  | "malformed";

export class CommuterMemoryError extends Error {
  constructor(
    message: string,
    readonly reason: CommuterMemoryFailureReason,
  ) {
    super(message);
    this.name = "CommuterMemoryError";
  }
}

const HANDLE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidHandle(value: string): boolean {
  return HANDLE_PATTERN.test(value);
}

export function assertValidHandle(value: string): void {
  if (!isValidHandle(value)) {
    throw new CommuterMemoryError("That memory handle is not valid.", "invalid-handle");
  }
}
