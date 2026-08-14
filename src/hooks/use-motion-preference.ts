"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

/**
 * How much motion this visitor wants.
 *
 *  - `full` is the default: the journey animates for everyone on arrival.
 *  - `reduced` removes all movement.
 *  - `system` defers to the OS setting, and remains supported for anyone who
 *    stored it previously.
 *
 * A NOTE ON THE DEFAULT, because it is a deliberate tradeoff and not an oversight.
 *
 * Defaulting to `full` means the app no longer follows `prefers-reduced-motion`
 * unasked. That setting is switched on wholesale by battery savers and corporate
 * machine images, so following it silently left many visitors — including this
 * app's owner — with a journey whose animation they could not see and did not know
 * existed. Apple publishes real criteria for honouring Reduced Motion
 * (https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria/),
 * and this default does not meet them.
 *
 * What keeps that defensible rather than careless:
 *  - The off switch is in the header on every screen, one click, no menu.
 *  - The choice persists, so it is asked once and never again.
 *  - `reduced` removes motion entirely rather than merely speeding it up, and no
 *    information is conveyed by animation alone.
 *
 * Changing the default back is a one-line edit in `readPreference`, and is the
 * right move if this ever ships to an audience wider than its author.
 */
export type MotionPreference = "system" | "full" | "reduced";

const STORAGE_KEY = "commute-lens:motion-preference";

function isMotionPreference(value: unknown): value is MotionPreference {
  return value === "system" || value === "full" || value === "reduced";
}

/*
 * The stored choice is treated as an external store rather than mirrored into
 * component state. Reading it in an effect and calling setState would mean an
 * extra render on every mount, and would animate the first frame with the wrong
 * preference before correcting itself.
 */
const listeners = new Set<() => void>();

/**
 * The starting point for a visitor who has never chosen, and the holding place for
 * a choice made when storage is unavailable so it still applies for this session.
 */
let sessionFallback: MotionPreference = "full";

function readPreference(): MotionPreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isMotionPreference(stored)) return stored;
  } catch {
    // Private browsing can refuse storage entirely.
  }
  return sessionFallback;
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  // `storage` fires in other tabs, so the choice follows the visitor across them.
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function writePreference(next: MotionPreference): void {
  sessionFallback = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // The session fallback already carries the choice.
  }
  for (const listener of listeners) listener();
}

export interface MotionPreferenceState {
  preference: MotionPreference;
  /** The single value every animated component in the tree should branch on. */
  reduceMotion: boolean;
  /** Exposed so the UI can explain that it is overriding an OS setting. */
  systemPrefersReduced: boolean;
  setPreference: (next: MotionPreference) => void;
}

export function useMotionPreference(): MotionPreferenceState {
  const systemPrefersReduced = usePrefersReducedMotion();

  /* The server snapshot matches the client default, so both renders agree and the
     first frame is already animating rather than correcting itself. */
  const preference = useSyncExternalStore(subscribe, readPreference, () => "full" as const);

  const setPreference = useCallback((next: MotionPreference) => writePreference(next), []);

  const reduceMotion = preference === "system" ? systemPrefersReduced : preference === "reduced";

  /*
   * Published to the document so CSS can agree with React. Without this, the
   * global `prefers-reduced-motion` reset in globals.css would keep flattening
   * every CSS transition in the app even for a visitor who asked for full motion,
   * and the two systems would openly contradict each other.
   */
  useEffect(() => {
    document.documentElement.dataset.motion = reduceMotion ? "reduced" : "full";
  }, [reduceMotion]);

  return { preference, reduceMotion, systemPrefersReduced, setPreference };
}
