"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { materialize, type MaterializeOptions } from "@/lib/motion";

/**
 * Reveals its children the first time they scroll into view.
 *
 * The journey's result page is long, and animating everything on mount meant the
 * lower two-thirds had finished animating before the reader ever got there — the
 * work was done off-screen and wasted. Tying the reveal to arrival is the Apple
 * marketing-page pattern: the page appears to assemble itself just ahead of you.
 *
 * `once: true` matters. Content that re-animates every time it re-enters the
 * viewport turns scrolling back up into a distraction.
 *
 * When motion is reduced this renders a plain wrapper, so nothing depends on an
 * intersection observer to become visible.
 */
export function Reveal({
  children,
  reduceMotion,
  className,
  /** Fraction of the element that must be visible before it starts. */
  amount = 0.2,
  ...options
}: {
  children: ReactNode;
  reduceMotion: boolean;
  className?: string;
  amount?: number;
} & MaterializeOptions) {
  if (reduceMotion) return <div className={className}>{children}</div>;

  const { initial, animate, transition } = materialize(false, options);

  return (
    <motion.div
      className={className}
      initial={initial}
      whileInView={animate}
      viewport={{ once: true, amount }}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}
