"use client";

import { gsap } from "gsap";
import { ArrowRight, RotateCcw } from "lucide-react";
import { useCallback, useLayoutEffect, useRef } from "react";
import { ActionButton } from "@/components/ui/action-button";
import { Eyebrow } from "@/components/ui/typography";
import { formatNumber, formatPeso } from "./format";

/**
 * The closing beat, choreographed with GSAP.
 *
 * Reached only from an explicit "Wrap up", so it can restate what the person
 * found rather than congratulating them for clicking. The reason to return is
 * named concretely — a second offer, or a shortlist already waiting — because
 * "come back soon" persuades nobody.
 *
 * Three rules govern the animation:
 *
 *  1. **The content is never hidden by CSS.** Every start state is set by GSAP at
 *     run time, so if the script fails or never loads, the full summary is still
 *     on screen and readable.
 *  2. **`gsap.matchMedia` owns reduced motion.** Users who ask for less motion get
 *     the same content with no movement whatsoever — not a faster version of the
 *     same sweep.
 *  3. **The counting figure is decorative.** It is `aria-hidden`, with a static
 *     sentence beside it for assistive tech, because a number ticking up thirty
 *     times a second is noise to a screen reader.
 *
 * GSAP is loaded only for this screen, so the rest of the journey never pays for
 * it.
 */

const RING_COUNT = 3;

/**
 * Builds the closing timeline automatically when the visitor has not asked for
 * less motion. Reduced-motion users receive the same content without movement.
 */
function buildTimeline(container: HTMLElement, onCount: (value: number) => void, target: number) {
  const q = gsap.utils.selector(container);
  const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });

  timeline
    // The panel arrives like a cut to a new scene, not a fade-in.
    .from(q("[data-outro='panel']"), {
      scale: 0.94,
      opacity: 0,
      duration: 0.7,
      ease: "power4.out",
    })
    // A light sweep across the dark panel: the "reveal" gesture.
    .fromTo(
      q("[data-outro='sweep']"),
      { xPercent: -130, opacity: 0.9 },
      { xPercent: 130, opacity: 0, duration: 1.1, ease: "power2.inOut" },
      0.15,
    )
    .from(
      q("[data-outro='stamp']"),
      { scale: 0, rotate: -35, duration: 0.75, ease: "back.out(2.2)" },
      0.35,
    )
    // Rings push outward from the stamp, then dissolve.
    .fromTo(
      q("[data-outro='ring']"),
      { scale: 0.4, opacity: 0.55 },
      { scale: 2.4, opacity: 0, duration: 1.3, stagger: 0.16, ease: "power2.out" },
      0.5,
    )
    .from(
      q("[data-outro='word']"),
      { yPercent: 115, opacity: 0, duration: 0.65, stagger: 0.045 },
      0.6,
    )
    .from(q("[data-outro='figure']"), { opacity: 0, y: 14, duration: 0.5 }, 1.05)
    .from(q("[data-outro='line']"), { opacity: 0, y: 12, duration: 0.5, stagger: 0.12 }, 1.45)
    .from(q("[data-outro='cta']"), { opacity: 0, y: 16, duration: 0.5, stagger: 0.08 }, 1.75);

  // The payoff counts up: the whole journey exists to produce this number.
  const counter = { value: 0 };
  timeline.to(
    counter,
    {
      value: target,
      duration: 1.6,
      ease: "power2.out",
      onUpdate: () => onCount(counter.value),
      // Guarantees the figure lands exactly on the calculated value, whatever the
      // easing did on the way there.
      onComplete: () => onCount(target),
    },
    1.05,
  );

  return timeline;
}

export function JourneyOutro({
  title,
  company,
  incomeAfterCommute,
  monthlyCommuteHours,
  rememberedOffers,
  hasCompared,
  onPlanAnother,
  onBackToResult,
}: {
  title: string;
  company: string;
  incomeAfterCommute: number;
  monthlyCommuteHours: number;
  rememberedOffers: number;
  hasCompared: boolean;
  /* No `reduceMotion` prop: gsap.matchMedia is the single authority here, and a
     second source of truth for the same preference is a bug waiting to happen. */
  onPlanAnother: () => void;
  onBackToResult: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  const amount = useRef<HTMLSpanElement>(null);
  const context = useRef<gsap.Context | null>(null);

  const renderAmount = useCallback((value: number) => {
    if (amount.current) amount.current.textContent = formatPeso(value);
  }, []);

  /**
   * Runs the automatic sequence inside a fresh GSAP context.
   */
  const play = useCallback(
    (container: HTMLElement) => {
      context.current?.revert();
      context.current = gsap.context(() => {
        const timeline = buildTimeline(container, renderAmount, incomeAfterCommute);

        /*
         * The safety net, and the reason this bug was possible at all: `.from()`
         * hides its targets the instant it is created. Anything that stops the
         * timeline finishing — a stalled ticker, a backgrounded tab, an error in a
         * later tween — would otherwise leave the summary permanently invisible.
         *
         * Content outlives its decoration. If the sequence has not completed
         * shortly after it should have, it is snapped to the end.
         */
        const failsafe = window.setTimeout(
          () => {
            if (timeline.progress() < 1) {
              // Surfaced rather than silently repaired: if this fires, the timeline
              // is stalling for a reason worth finding.
              console.warn(
                `[journey-outro] timeline stalled at ${timeline.progress().toFixed(2)}; snapped to the end.`,
              );
              timeline.progress(1, false);
              renderAmount(incomeAfterCommute);
            }
          },
          (timeline.duration() + 1) * 1000,
        );

        return () => window.clearTimeout(failsafe);
      }, container);
    },
    [incomeAfterCommute, renderAmount],
  );

  useLayoutEffect(() => {
    const container = root.current;
    if (!container) return;

    /*
     * matchMedia is doing the accessibility work rather than a hand-rolled check:
     * GSAP tears down every tween for a context when the query stops matching, so a
     * visitor toggling the OS setting mid-visit is left with clean, unanimated
     * markup instead of a half-played timeline.
     */
    const media = gsap.matchMedia();

    media.add("(prefers-reduced-motion: no-preference)", () => {
      play(container);
      return () => renderAmount(incomeAfterCommute);
    });

    return () => {
      media.revert();
      context.current?.revert();
      context.current = null;
    };
  }, [incomeAfterCommute, play, renderAmount]);

  const headline = `You know what ${title} at ${company}`;

  return (
    <section ref={root} className="mx-auto max-w-3xl pt-8 lg:pt-14">
      <div
        data-outro="panel"
        className="ink-panel on-ink relative isolate overflow-hidden p-7 text-center sm:p-10"
      >
        <span
          data-outro="sweep"
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 -left-1/3 z-10 w-1/3 skew-x-12 bg-gradient-to-r from-transparent via-mint/25 to-transparent"
        />

        <div className="relative mx-auto grid size-24 place-items-center">
          {Array.from({ length: RING_COUNT }, (_, index) => (
            <span
              key={index}
              data-outro="ring"
              aria-hidden="true"
              className="absolute size-16 rounded-full border border-mint opacity-0"
            />
          ))}
          <span
            data-outro="stamp"
            aria-hidden="true"
            className="grid size-16 place-items-center rounded-full bg-mint font-headline text-[0.62rem] leading-none font-black tracking-[0.1em] text-ink"
          >
            FILED
          </span>
        </div>

        <Eyebrow tone="mint" className="mt-6">
          <span data-outro="line" className="inline-block">
            That is the full picture
          </span>
        </Eyebrow>

        <h2 className="mt-3 font-headline text-[clamp(1.7rem,4vw,2.6rem)] leading-[0.98] font-black tracking-[-0.04em]">
          {/* Word-level spans so the headline can rise line by line. Each wrapper
              clips its word, which is what makes the lift read as deliberate. */}
          {headline.split(" ").map((word, index) => (
            <span key={`${word}-${index}`} className="inline-block overflow-hidden align-bottom">
              <span data-outro="word" className="inline-block">
                {word}
                {"\u00A0"}
              </span>
            </span>
          ))}
          <span className="inline-block overflow-hidden align-bottom">
            <span
              data-outro="word"
              className="font-highlight inline-block font-normal text-mint italic"
            >
              really pays.
            </span>
          </span>
        </h2>

        <p data-outro="figure" className="mt-6">
          <span
            ref={amount}
            aria-hidden="true"
            className="numeric font-headline text-[clamp(2.2rem,7vw,3.4rem)] leading-none font-black tracking-[-0.03em] text-mint"
          >
            {formatPeso(incomeAfterCommute)}
          </span>
          <span className="mt-2 block text-[0.66rem] font-black tracking-[0.18em] text-paper/60 uppercase">
            Left each month after getting to work
          </span>
        </p>

        <p className="sr-only">
          {formatPeso(incomeAfterCommute)} left each month after getting to work, with{" "}
          {formatNumber(monthlyCommuteHours)} hours a month spent travelling.
        </p>

        <p
          data-outro="line"
          aria-hidden="true"
          className="mx-auto mt-5 max-w-prose text-sm leading-relaxed text-paper/80"
        >
          That is after{" "}
          <strong className="font-black text-paper">
            {formatNumber(monthlyCommuteHours)} hours
          </strong>{" "}
          of your month spent travelling — a number a salary alone never showed you.
        </p>

        {/*
          The reason to return has to be specific to what this person just did,
          or it is noise. Three situations, three different next steps.
        */}
        <p
          data-outro="line"
          className="mx-auto mt-4 max-w-prose text-sm leading-relaxed text-paper/70"
        >
          {rememberedOffers > 0
            ? `Your file already holds ${rememberedOffers} analyzed ${rememberedOffers === 1 ? "offer" : "offers"}. Add the next one and the shortlist builds itself.`
            : hasCompared
              ? "You have seen how differently two offers can land. Keep the next one in your file and the shortlist builds itself."
              : "One offer is a number. Two is a decision — run the other one and see which actually leaves you better off."}
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <span data-outro="cta" className="inline-block">
            <ActionButton variant="accent" onClick={onPlanAnother}>
              Plan another offer
              <ArrowRight className="size-4" aria-hidden="true" />
            </ActionButton>
          </span>
          <span data-outro="cta" className="inline-block">
            <ActionButton variant="quiet" className="text-paper/80" onClick={onBackToResult}>
              <RotateCcw className="size-4" aria-hidden="true" />
              {hasCompared ? "Back to my comparison" : "Back to my result"}
            </ActionButton>
          </span>
        </div>

      </div>
    </section>
  );
}
