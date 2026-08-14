"use client";

import { animate, motion, useMotionValue, useMotionValueEvent } from "motion/react";
import { ArrowRight, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { ActionButton } from "@/components/ui/action-button";
import { Eyebrow } from "@/components/ui/typography";
import {
  EASE_DECELERATE,
  SPRING_BOUNCY,
  SPRING_CINEMATIC,
  SPRING_SMOOTH,
  cue,
  materialize,
  stagger,
} from "@/lib/motion";
import { formatNumber, formatPeso } from "./format";

/**
 * The closing beat.
 *
 * Reached only from an explicit "Wrap up", so it can restate what the person
 * found rather than congratulating them for clicking. The reason to return is
 * named concretely — a second offer, or a shortlist already waiting — because
 * "come back soon" persuades nobody.
 *
 * Choreographed with the shared vocabulary in `@/lib/motion`, which is spring-led
 * after Apple's platform guidance. In practice that means two things here:
 * everything arrives from close range rather than flying in, and exactly one
 * element — the stamp — is allowed to overshoot. A screen where everything bounces
 * has no accent. Only opacity and transform move, so a mid-range phone can run the
 * whole sequence on the compositor.
 *
 * It previously ran on GSAP, which meant two animation libraries and two
 * independent reduced-motion authorities: this screen gated itself on
 * `gsap.matchMedia("(prefers-reduced-motion: no-preference)")` while everything
 * else read `reduceMotion` from React, so a visitor who turned motion on in the
 * app still got nothing here. One library, one prop, no disagreement.
 *
 * Two rules survive from that version:
 *
 *  1. **The content is never hidden by CSS.** Start states live in Motion's
 *     `initial` props, so if hydration never happens the summary is still readable.
 *  2. **The counting figure is decorative.** It is `aria-hidden`, with a static
 *     sentence beside it for assistive tech, because a number ticking up thirty
 *     times a second is noise to a screen reader.
 */

const RING_COUNT = 3;

/**
 * The running order, in seconds.
 *
 * One object rather than delays scattered through the markup, so the sequence can
 * be read and retimed as a whole. The overlaps are deliberate: each beat begins
 * while the previous is still settling.
 */
const BEAT = {
  panel: 0,
  sweep: 0.3,
  stamp: 0.5,
  ring: 0.62,
  word: 0.78,
  figure: 1.3,
  line: 1.75,
  cta: 2.2,
} as const;

const COUNT_UP_DURATION = 1.9;

/**
 * The payoff figure, counting up.
 *
 * Separate because it holds the only state on this screen. Driven by a motion
 * value so it runs on Motion's frame loop rather than a React interval, and it
 * lands exactly on `value` because that is the number the whole app has been
 * working towards.
 */
function ClosingFigure({ value, reduceMotion }: { value: number; reduceMotion: boolean }) {
  const motionValue = useMotionValue(reduceMotion ? value : 0);
  const [display, setDisplay] = useState(reduceMotion ? value : 0);

  useMotionValueEvent(motionValue, "change", setDisplay);

  useEffect(() => {
    if (reduceMotion) return;
    const controls = animate(motionValue, value, {
      duration: COUNT_UP_DURATION,
      delay: BEAT.figure,
      ease: "easeOut",
    });
    return controls.stop;
  }, [motionValue, reduceMotion, value]);

  return (
    <span
      aria-hidden="true"
      className="numeric font-headline text-[clamp(2.2rem,7vw,3.4rem)] leading-none font-black tracking-[-0.03em] text-mint"
    >
      {formatPeso(reduceMotion ? value : display)}
    </span>
  );
}

export function JourneyOutro({
  title,
  company,
  incomeAfterCommute,
  monthlyCommuteHours,
  rememberedOffers,
  hasCompared,
  reduceMotion,
  onPlanAnother,
  onBackToResult,
}: {
  title: string;
  company: string;
  incomeAfterCommute: number;
  monthlyCommuteHours: number;
  rememberedOffers: number;
  hasCompared: boolean;
  reduceMotion: boolean;
  onPlanAnother: () => void;
  onBackToResult: () => void;
}) {
  const headline = `You know what ${title} at ${company}`;
  const words = headline.split(" ");

  /** The closing sentence, which differs by what this person actually did. */
  const returnReason =
    rememberedOffers > 0
      ? `Your file already holds ${rememberedOffers} analyzed ${rememberedOffers === 1 ? "offer" : "offers"}. Add the next one and the shortlist builds itself.`
      : hasCompared
        ? "You have seen how differently two offers can land. Keep the next one in your file and the shortlist builds itself."
        : "One offer is a number. Two is a decision — run the other one and see which actually leaves you better off.";

  /** Words rise out of their clipping mask. Percentage travel, so springs suit it less than a curve. */
  const wordCue = (index: number) =>
    cue(
      reduceMotion,
      { y: "115%", opacity: 0 },
      { y: "0%", opacity: 1 },
      { duration: 0.85, delay: BEAT.word + stagger(index, 0.052, 0.75), ease: EASE_DECELERATE },
    );

  return (
    <section className="mx-auto max-w-3xl pt-8 lg:pt-14">
      {/* The panel carries the whole screen in with it, so it gets the slowest spring. */}
      <motion.div
        {...materialize(reduceMotion, {
          delay: BEAT.panel,
          distance: 34,
          scale: 0.94,
          transition: SPRING_CINEMATIC,
        })}
        className="ink-panel on-ink relative isolate overflow-hidden p-7 text-center sm:p-10"
      >
        {/* A light sweep across the dark panel: the "reveal" gesture. */}
        <motion.span
          aria-hidden="true"
          {...cue(
            reduceMotion,
            { x: "-130%", opacity: 0.9 },
            { x: "130%", opacity: 0 },
            { duration: 1.35, delay: BEAT.sweep, ease: [0.4, 0, 0.2, 1] },
          )}
          className="pointer-events-none absolute inset-y-0 -left-1/3 z-10 w-1/3 skew-x-12 bg-gradient-to-r from-transparent via-mint/25 to-transparent"
        />

        <div className="relative mx-auto grid size-24 place-items-center">
          {/* Rings push outward from the stamp, then dissolve. The opacity-0 class
              keeps them invisible before hydration, since their whole life is an
              animation. */}
          {Array.from({ length: RING_COUNT }, (_, index) => (
            <motion.span
              key={index}
              aria-hidden="true"
              {...cue(
                reduceMotion,
                { scale: 0.4, opacity: 0.55 },
                { scale: 2.5, opacity: 0 },
                { duration: 1.6, delay: BEAT.ring + index * 0.2, ease: EASE_DECELERATE },
              )}
              className="absolute size-16 rounded-full border border-mint opacity-0"
            />
          ))}
          {/* The one element permitted to overshoot. It is the moment the file closes. */}
          <motion.span
            aria-hidden="true"
            {...cue(
              reduceMotion,
              { scale: 0, rotate: -30 },
              { scale: 1, rotate: 0 },
              { ...SPRING_BOUNCY, delay: BEAT.stamp },
            )}
            className="grid size-16 place-items-center rounded-full bg-mint font-headline text-[0.62rem] leading-none font-black tracking-[0.1em] text-ink"
          >
            FILED
          </motion.span>
        </div>

        <Eyebrow tone="mint" className="mt-6">
          <motion.span
            {...materialize(reduceMotion, {
              delay: BEAT.line,
              distance: 10,
              scale: 1,
              transition: SPRING_SMOOTH,
            })}
            className="inline-block"
          >
            That is the full picture
          </motion.span>
        </Eyebrow>

        <h2 className="mt-3 font-headline text-[clamp(1.7rem,4vw,2.6rem)] leading-[0.98] font-black tracking-[-0.04em]">
          {/* Word-level spans so the headline rises piece by piece. Each wrapper
              clips its word, which is what makes the lift read as deliberate. */}
          {words.map((word, index) => (
            <span key={`${word}-${index}`} className="inline-block overflow-hidden align-bottom">
              <motion.span {...wordCue(index)} className="inline-block">
                {word}
                {"\u00A0"}
              </motion.span>
            </span>
          ))}
          <span className="inline-block overflow-hidden align-bottom">
            <motion.span
              {...wordCue(words.length)}
              className="font-highlight inline-block font-normal text-mint italic"
            >
              really pays.
            </motion.span>
          </span>
        </h2>

        <motion.p
          {...materialize(reduceMotion, {
            delay: BEAT.figure,
            distance: 18,
            scale: 0.92,
            transition: SPRING_SMOOTH,
          })}
          className="mt-6"
        >
          <ClosingFigure value={incomeAfterCommute} reduceMotion={reduceMotion} />
          <span className="mt-2 block text-[0.66rem] font-black tracking-[0.18em] text-paper/60 uppercase">
            Left each month after getting to work
          </span>
        </motion.p>

        <p className="sr-only">
          {formatPeso(incomeAfterCommute)} left each month after getting to work, with{" "}
          {formatNumber(monthlyCommuteHours)} hours a month spent travelling.
        </p>

        <motion.p
          aria-hidden="true"
          {...materialize(reduceMotion, {
            delay: BEAT.line + 0.16,
            distance: 14,
            scale: 1,
          })}
          className="mx-auto mt-5 max-w-prose text-sm leading-relaxed text-paper/80"
        >
          That is after{" "}
          <strong className="font-black text-paper">
            {formatNumber(monthlyCommuteHours)} hours
          </strong>{" "}
          of your month spent travelling — a number a salary alone never showed you.
        </motion.p>

        {/*
          The reason to return has to be specific to what this person just did,
          or it is noise. Three situations, three different next steps.
        */}
        <motion.p
          {...materialize(reduceMotion, {
            delay: BEAT.line + 0.32,
            distance: 14,
            scale: 1,
          })}
          className="mx-auto mt-4 max-w-prose text-sm leading-relaxed text-paper/70"
        >
          {returnReason}
        </motion.p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <motion.span
            {...materialize(reduceMotion, {
              delay: BEAT.cta,
              distance: 16,
              scale: 0.96,
              transition: SPRING_SMOOTH,
            })}
            className="inline-block"
          >
            <ActionButton variant="accent" onClick={onPlanAnother}>
              Plan another offer
              <ArrowRight className="size-4" aria-hidden="true" />
            </ActionButton>
          </motion.span>
          <motion.span
            {...materialize(reduceMotion, {
              delay: BEAT.cta + 0.09,
              distance: 16,
              scale: 0.96,
              transition: SPRING_SMOOTH,
            })}
            className="inline-block"
          >
            <ActionButton variant="quiet" className="text-paper/80" onClick={onBackToResult}>
              <RotateCcw className="size-4" aria-hidden="true" />
              {hasCompared ? "Back to my comparison" : "Back to my result"}
            </ActionButton>
          </motion.span>
        </div>
      </motion.div>
    </section>
  );
}
