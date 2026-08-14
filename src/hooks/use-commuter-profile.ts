"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CommuterMemoryResult } from "@/app/api/commuter-profile/route";
import type {
  CommuterMemoryRecord,
  CommuterProfile,
  OfferLedgerEntry,
} from "@/application/commuter-profile/memory";

/**
 * Client side of the commuter memory layer.
 *
 * The handle is the only thing kept in the browser, and it is written to local
 * storage the first time the user asks to be remembered — never before. Clearing
 * it is part of forgetting, so a failed server delete leaves the handle in place
 * rather than orphaning data the user can no longer reach or remove.
 */

const HANDLE_STORAGE_KEY = "commutelens.memory.handle.v1";

export type CommuterProfileInput = Omit<CommuterProfile, "version" | "updatedAt">;

export type CommuterMemoryStatus = "idle" | "loading" | "ready" | "error";

export interface CommuterMemoryState {
  handle: string | null;
  status: CommuterMemoryStatus;
  storage: "backboard" | "session-only" | "none";
  profile: CommuterProfile | null;
  offers: readonly OfferLedgerEntry[];
  records: readonly CommuterMemoryRecord[];
  /** A user-facing note about the last operation. Null when nothing to say. */
  message: string | null;
}

const INITIAL: CommuterMemoryState = {
  handle: null,
  status: "idle",
  storage: "none",
  profile: null,
  offers: [],
  records: [],
  message: null,
};

function readStoredHandle(): string | null {
  try {
    return window.localStorage.getItem(HANDLE_STORAGE_KEY);
  } catch {
    // Private browsing or a blocked storage partition. Memory simply stays off.
    return null;
  }
}

function writeStoredHandle(handle: string | null): void {
  try {
    if (handle === null) window.localStorage.removeItem(HANDLE_STORAGE_KEY);
    else window.localStorage.setItem(HANDLE_STORAGE_KEY, handle);
  } catch {
    /* Non-fatal: the profile just will not be recalled next visit. */
  }
}

async function post(body: unknown): Promise<CommuterMemoryResult> {
  const response = await fetch("/api/commuter-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await response.json()) as CommuterMemoryResult;
}

export function useCommuterProfile() {
  const [state, setState] = useState<CommuterMemoryState>(INITIAL);
  // Monotonic guard, matching the stale-response pattern used by the journey.
  const requestVersion = useRef(0);

  /*
   * Recall on mount, if this browser holds a handle.
   *
   * State is only set inside the async continuation. Setting it synchronously in
   * the effect body would cascade a render on every visit, including the common
   * case where there is nothing stored to recall.
   */
  useEffect(() => {
    const stored = readStoredHandle();
    if (!stored) return;

    let cancelled = false;
    void (async () => {
      const version = ++requestVersion.current;
      const result = await post({ intent: "recall", handle: stored }).catch(() => null);
      if (cancelled || version !== requestVersion.current) return;

      if (!result?.success || result.data.kind !== "snapshot") {
        setState((current) => ({ ...current, handle: stored, status: "error" }));
        return;
      }
      if (result.data.degradedReason === "not-found") {
        // The file behind this handle is gone. Forget the handle rather than
        // showing a saved setup that cannot be read or deleted.
        writeStoredHandle(null);
        setState({ ...INITIAL, status: "ready" });
        return;
      }
      setState({
        handle: stored,
        status: "ready",
        storage: result.data.storage,
        profile: result.data.profile,
        offers: result.data.offers,
        records: result.data.records,
        message: null,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  /** Creates the handle on first use, so nothing is stored until this is called. */
  const ensureHandle = useCallback(async (): Promise<string | null> => {
    if (state.handle) return state.handle;
    const result = await post({ intent: "create" });
    if (!result.success || result.data.kind !== "handle" || !result.data.handle) return null;
    const created = result.data.handle;
    writeStoredHandle(created);
    setState((current) => ({ ...current, handle: created }));
    return created;
  }, [state.handle]);

  /** Drops a handle whose file no longer exists, so the browser can start clean. */
  const discardStaleHandle = useCallback((message: string) => {
    writeStoredHandle(null);
    setState({ ...INITIAL, status: "ready", message });
  }, []);

  const applySnapshot = useCallback(
    (result: CommuterMemoryResult, successMessage: string) => {
      if (!result.success || result.data.kind !== "snapshot") {
        setState((current) => ({
          ...current,
          status: "error",
          message: "That could not be saved. Nothing was stored.",
        }));
        return;
      }
      const { storage, profile, offers, records, degradedReason } = result.data;

      if (degradedReason === "not-found") {
        discardStaleHandle("Your saved file was no longer there, so nothing is stored now.");
        return;
      }
      setState((current) => ({
        ...current,
        status: degradedReason ? "error" : "ready",
        storage,
        profile,
        offers,
        records,
        message: degradedReason
          ? "That could not be saved. Nothing was stored."
          : storage === "session-only"
            ? `${successMessage} This build stores it for this server session only.`
            : successMessage,
      }));
    },
    [discardStaleHandle],
  );

  const remember = useCallback(
    async (profile: CommuterProfileInput) => {
      const version = ++requestVersion.current;
      setState((current) => ({ ...current, status: "loading", message: null }));
      try {
        const handle = await ensureHandle();
        if (!handle) {
          setState((current) => ({
            ...current,
            status: "error",
            message: "Saving is unavailable right now. Nothing was stored.",
          }));
          return;
        }
        const result = await post({ intent: "remember", handle, profile });
        if (version !== requestVersion.current) return;
        applySnapshot(result, "Saved. Your setup will be waiting next visit.");
      } catch {
        if (version === requestVersion.current) {
          setState((current) => ({
            ...current,
            status: "error",
            message: "That could not be saved. Nothing was stored.",
          }));
        }
      }
    },
    [applySnapshot, ensureHandle],
  );

  /**
   * Sends the analysis *inputs*, not the results, so the server recalculates the
   * remembered figures and the shortlist cannot drift from the receipt.
   */
  const rememberOffer = useCallback(
    async (offer: unknown) => {
      const version = ++requestVersion.current;
      setState((current) => ({ ...current, status: "loading", message: null }));
      try {
        const handle = await ensureHandle();
        if (!handle) {
          setState((current) => ({
            ...current,
            status: "error",
            message: "Saving is unavailable right now. Nothing was stored.",
          }));
          return;
        }
        const result = await post({ intent: "remember-offer", handle, offer });
        if (version !== requestVersion.current) return;
        applySnapshot(result, "Added to your remembered shortlist.");
      } catch {
        if (version === requestVersion.current) {
          setState((current) => ({
            ...current,
            status: "error",
            message: "That could not be saved. Nothing was stored.",
          }));
        }
      }
    },
    [applySnapshot, ensureHandle],
  );

  const forgetOffer = useCallback(
    async (offerId: string) => {
      if (!state.handle) return;
      const version = ++requestVersion.current;
      setState((current) => ({ ...current, status: "loading", message: null }));
      try {
        const result = await post({ intent: "forget-offer", handle: state.handle, offerId });
        if (version !== requestVersion.current) return;
        applySnapshot(result, "Removed from your shortlist.");
      } catch {
        if (version === requestVersion.current) {
          setState((current) => ({
            ...current,
            status: "error",
            message: "That could not be removed, so it is still stored. Please try again.",
          }));
        }
      }
    },
    [applySnapshot, state.handle],
  );

  const forget = useCallback(async () => {
    if (!state.handle) return;
    const version = ++requestVersion.current;
    setState((current) => ({ ...current, status: "loading", message: null }));
    try {
      const result = await post({ intent: "forget", handle: state.handle });
      if (version !== requestVersion.current) return;
      if (!result.success || result.data.kind !== "forget" || !result.data.forgotten) {
        setState((current) => ({
          ...current,
          status: "error",
          message: "Deletion failed, so your saved data is still stored. Please try again.",
        }));
        return;
      }
      writeStoredHandle(null);
      setState({ ...INITIAL, status: "ready", message: "Deleted. Nothing is stored any more." });
    } catch {
      if (version === requestVersion.current) {
        setState((current) => ({
          ...current,
          status: "error",
          message: "Deletion failed, so your saved data is still stored. Please try again.",
        }));
      }
    }
  }, [state.handle]);

  return { ...state, remember, rememberOffer, forgetOffer, forget } as const;
}
