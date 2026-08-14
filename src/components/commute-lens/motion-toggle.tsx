"use client";

import { Zap, ZapOff } from "lucide-react";
import type { MotionPreference } from "@/hooks/use-motion-preference";

/**
 * Lets a visitor turn the journey's animation on even when their system asks for
 * less motion, and off even when it does not.
 *
 * Implemented as a toggle button rather than a three-way control: "follow my
 * system" is the starting state, and the moment someone touches this they have
 * expressed a preference, so there is nothing useful left to choose between.
 * `aria-pressed` carries the state, and the label is text rather than icon-only
 * so it is not a guessing game.
 */
export function MotionToggle({
  reduceMotion,
  systemPrefersReduced,
  onChange,
}: {
  reduceMotion: boolean;
  systemPrefersReduced: boolean;
  onChange: (next: MotionPreference) => void;
}) {
  const Icon = reduceMotion ? ZapOff : Zap;

  return (
    <button
      type="button"
      aria-pressed={!reduceMotion}
      onClick={() => onChange(reduceMotion ? "full" : "reduced")}
      title={
        reduceMotion && systemPrefersReduced
          ? "Your system asks for reduced motion. Turn the animations on anyway."
          : reduceMotion
            ? "Turn the journey animations on"
            : "Turn the journey animations off"
      }
      className="flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-ink/15 px-2.5 text-[0.62rem] font-black tracking-[0.12em] text-muted uppercase transition-colors hover:border-ink/35 hover:text-ink print:hidden"
    >
      <Icon className="size-3.5" aria-hidden="true" />
      <span className="hidden sm:inline">{reduceMotion ? "Animation off" : "Animation on"}</span>
      <span className="sr-only sm:hidden">
        {reduceMotion ? "Turn animation on" : "Turn animation off"}
      </span>
    </button>
  );
}
