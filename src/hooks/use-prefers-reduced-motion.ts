"use client";

import { useSyncExternalStore } from "react";

/**
 * `useSyncExternalStore` deliberately returns `false` for the server and the
 * hydration render, then reads the browser preference after hydration. This
 * keeps Motion's initial inline styles identical on both sides of the render.
 *
 * Every animated component in the app takes the result as a prop rather than
 * calling this hook itself, so a single subscription drives the whole tree.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      query.addEventListener("change", onStoreChange);
      return () => query.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}
