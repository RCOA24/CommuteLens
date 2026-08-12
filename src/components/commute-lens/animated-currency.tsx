"use client";

import { animate, useMotionValue, useMotionValueEvent } from "motion/react";
import { useEffect, useState } from "react";
import { formatPeso } from "./format";

/**
 * Counts a peso figure up to its value. The count-up is the one place where
 * motion carries meaning rather than decoration: it is the moment the user
 * watches an advertised salary become a real one.
 */
export function AnimatedCurrency({
  value,
  reduceMotion,
  className = "",
}: {
  value: number;
  reduceMotion: boolean;
  className?: string;
}) {
  const motionValue = useMotionValue(value);
  const [display, setDisplay] = useState(value);

  useMotionValueEvent(motionValue, "change", setDisplay);

  useEffect(() => {
    // Nothing to animate: the render below reads `value` directly in this case.
    if (reduceMotion) return;
    const controls = animate(motionValue, value, { duration: 0.7, ease: "easeOut" });
    return controls.stop;
  }, [value, motionValue, reduceMotion]);

  return (
    <span className={`numeric ${className}`}>{formatPeso(reduceMotion ? value : display)}</span>
  );
}
