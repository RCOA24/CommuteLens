import type { OfferDocumentExtractionProvider } from "@/application/extract-offer-document/offer-extraction";
import type { CommuterMemoryStore } from "@/application/commuter-profile/store";
import { BackboardClient } from "./backboard-client";
import { BackboardCommuterMemoryStore } from "./backboard-commuter-memory.store";
import { BackboardOfferExtractionProvider } from "./backboard-offer-extraction.provider";
import { InMemoryCommuterMemoryStore } from "./in-memory-commuter-memory.store";

export { BackboardClient, BackboardError } from "./backboard-client";
export { BackboardCommuterMemoryStore } from "./backboard-commuter-memory.store";
export { BackboardOfferExtractionProvider } from "./backboard-offer-extraction.provider";
export { InMemoryCommuterMemoryStore } from "./in-memory-commuter-memory.store";

let cachedExtractionProvider: OfferDocumentExtractionProvider | null | undefined;
let cachedMemoryStore: CommuterMemoryStore | undefined;

function isBackboardEnabled(): boolean {
  // Tests must never reach a live provider, and an absent key is a normal,
  // supported configuration rather than a misconfiguration.
  if (process.env.NODE_ENV === "test") return false;
  return new BackboardClient().isConfigured;
}

/**
 * Returns null when Backboard is not configured, which the extraction use case
 * reports as `not-configured` instead of failing the request.
 */
export function getOfferDocumentExtractionProvider(): OfferDocumentExtractionProvider | null {
  if (cachedExtractionProvider !== undefined) return cachedExtractionProvider;
  return (cachedExtractionProvider = isBackboardEnabled()
    ? new BackboardOfferExtractionProvider()
    : null);
}

/**
 * Always returns a store. Without Backboard — or with `BACKBOARD_MEMORY=off` —
 * that store is process-local and says so, so the UI can label the difference
 * rather than implying durability it does not have.
 */
export function getCommuterMemoryStore(): CommuterMemoryStore {
  if (cachedMemoryStore) return cachedMemoryStore;
  const memoryDisabled = process.env.BACKBOARD_MEMORY?.trim().toLowerCase() === "off";
  return (cachedMemoryStore =
    isBackboardEnabled() && !memoryDisabled
      ? new BackboardCommuterMemoryStore()
      : new InMemoryCommuterMemoryStore());
}

export function resetBackboardProviders(): void {
  cachedExtractionProvider = undefined;
  cachedMemoryStore = undefined;
}
