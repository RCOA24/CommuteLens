import type { TargetAndTransition, Transition } from "motion/react";

/**
 * The app's motion vocabulary, in one place.
 *
 * Modelled on how Apple describes motion rather than on stiffness-and-damping
 * numbers. Two ideas from their platform work do most of the job here:
 *
 *  1. **Springs, not curves.** Apple's guidance treats springs as the default
 *     tool because they are interruptible and velocity-aware — motion starts from
 *     wherever a thing currently is instead of restarting from a fixed keyframe.
 *     See Apple's WWDC23 session "Animate with springs":
 *     https://developer.apple.com/videos/play/wwdc2023/10158/
 *  2. **Continuity.** A thing that appears somewhere new without travelling there
 *     reads as a jump cut. Elements should arrive from a nearby position, at a
 *     nearby size, rather than blinking into place.
 *
 * Springs are described as duration plus bounce, which is the same pair SwiftUI
 * exposes, because "how long, and how springy" is a question a designer can
 * actually answer. Stiffness and mass are not.
 *
 * Content was rephrased from Apple's developer documentation for compliance with
 * licensing restrictions.
 */

/** No overshoot at all. The workhorse: things glide in and stop. */
export const SPRING_SMOOTH: Transition = { type: "spring", duration: 0.72, bounce: 0 };

/** A trace of overshoot, for controls and small state changes. */
export const SPRING_SNAPPY: Transition = { type: "spring", duration: 0.5, bounce: 0.18 };

/** Visible overshoot, reserved for a single moment of celebration per screen. */
export const SPRING_BOUNCY: Transition = { type: "spring", duration: 0.65, bounce: 0.42 };

/** Slow, heavy arrival for large surfaces that carry the whole screen with them. */
export const SPRING_CINEMATIC: Transition = { type: "spring", duration: 1.05, bounce: 0.06 };

/**
 * A strongly decelerating curve, for the few properties springs suit badly —
 * opacity, blur, and anything travelling a percentage of its own width.
 */
export const EASE_DECELERATE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Exits are quicker than entrances: nobody needs to watch something leave. */
export const EASE_EXIT: [number, number, number, number] = [0.4, 0, 1, 1];

/**
 * The shape of a Motion prop bundle, so the reduced-motion and full-motion paths
 * are interchangeable at a call site.
 */
export interface MotionCue {
  initial: TargetAndTransition | false;
  animate: TargetAndTransition;
  transition?: Transition;
}

export interface MaterializeOptions {
  delay?: number;
  /** Vertical travel in pixels. Kept small: Apple's arrivals are close-range. */
  distance?: number;
  /** Starting scale. Just under 1, so it reads as depth rather than as a zoom. */
  scale?: number;
  /** Starting blur in pixels. 0 opts out, which is the right call for long lists. */
  blur?: number;
  transition?: Transition;
}

/**
 * The house entrance: rise a little, grow a little, sharpen from a blur.
 *
 * The blur is what makes this feel like Apple's material rather than a plain
 * fade — an element resolves into focus as though it were settling into the
 * frame. It is also the expensive part, so it is a knob and not a constant.
 *
 * Reduced motion returns `initial: false`, which mounts the element at its final
 * values and animates nothing. One set of markup serves both paths, so there is
 * no second copy of a screen to keep in sync.
 */
export function materialize(reduceMotion: boolean, options: MaterializeOptions = {}): MotionCue {
  const { delay = 0, distance = 22, scale = 0.97, blur = 8, transition = SPRING_SMOOTH } = options;

  const settled = { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" };
  if (reduceMotion) return { initial: false, animate: settled };

  return {
    initial: { opacity: 0, y: distance, scale, filter: `blur(${blur}px)` },
    animate: settled,
    transition: { ...transition, delay },
  };
}

/**
 * Builds an arbitrary cue with the same reduced-motion contract as `materialize`.
 * For the moments that need their own start state — a sweep travelling across a
 * panel, a stamp rotating into place.
 */
export function cue(
  reduceMotion: boolean,
  hidden: TargetAndTransition,
  shown: TargetAndTransition,
  transition: Transition,
): MotionCue {
  if (reduceMotion) return { initial: false, animate: shown };
  return { initial: hidden, animate: shown, transition };
}

/**
 * Staggering by index.
 *
 * Overlapping is the point: each item starts before the previous has settled, so
 * a group reads as one gesture instead of a queue. Beyond `maximum` the delay
 * stops growing, because the twelfth item in a list waiting a full second to
 * appear is not choreography, it is latency.
 */
export function stagger(index: number, step = 0.055, maximum = 0.44): number {
  return Math.min(index * step, maximum);
}
