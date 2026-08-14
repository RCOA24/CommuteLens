"use client";

import { ArrowLeft, ArrowRight, CircleCheck, Route as RouteIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/action-button";
import { Eyebrow } from "@/components/ui/typography";
import { calculateCommute } from "@/domain/commute/calculations";
import type { CommuteRoute } from "@/domain/models";
import { formatNumber, formatPeso } from "./format";

/**
 * A deliberate, user-controlled pause between pricing and the Reality stage.
 * The completed analysis remains here until the user chooses to reveal it, so
 * neither the checklist nor the result transition can flash past unnoticed.
 */
export function CalculatingStage({
  route,
  onsiteDays,
  reduceMotion,
  isReady,
  onBack,
  onReveal,
}: {
  route: CommuteRoute | null;
  onsiteDays: number;
  reduceMotion: boolean;
  isReady: boolean;
  onBack: () => void;
  onReveal: () => void;
}) {
  const [tick, setTick] = useState(0);
  const [isRevealing, setIsRevealing] = useState(false);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (revealTimer.current) clearTimeout(revealTimer.current);
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const timers = [320, 820, 1320].map((ms, index) => setTimeout(() => setTick(index + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, [reduceMotion]);

  function startReveal() {
    if (isRevealing) return;
    if (reduceMotion) {
      onReveal();
      return;
    }

    setIsRevealing(true);
    revealTimer.current = setTimeout(onReveal, 1_250);
  }

  const revealed = reduceMotion ? 3 : tick;
  const commute = calculateCommute(route, onsiteDays);
  const items = [
    {
      label: "Your route",
      value: route
        ? `${formatNumber(route.oneWayDurationMinutes)} minutes each way`
        : "No commute to price",
    },
    {
      label: "Your month",
      value: `${formatNumber(commute.officeDaysPerMonth)} office days`,
    },
    {
      label: "Your fares",
      value: `${formatPeso(commute.dailyFare)} per office day`,
    },
  ];

  return (
    <div className="mx-auto max-w-md pt-16 text-center sm:pt-24">
      <span
        className="mx-auto grid size-14 place-items-center rounded-full border border-ink/12 bg-paper/70"
        aria-hidden="true"
      >
        <RouteIcon className="size-5 text-accent" />
      </span>
      <Eyebrow className="mt-6">Putting it together</Eyebrow>
      <h1 className="mt-2 font-headline text-3xl leading-none font-black tracking-[-0.035em]">
        Pricing your commute…
      </h1>

      <div className="mt-7 h-1 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
        <motion.div
          className="h-full origin-left rounded-full bg-accent"
          initial={{ scaleX: reduceMotion ? 1 : 0.05 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: reduceMotion ? 0 : 1.95, ease: "easeInOut" }}
        />
      </div>

      <ul className="mt-6 divide-y divide-ink/10 border-y border-ink/10 text-left">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-3.5 py-3.5">
            <span
              className={`grid size-5 shrink-0 place-items-center transition-opacity ${
                revealed > index ? "opacity-100" : "opacity-40"
              }`}
              aria-hidden="true"
            >
              {revealed > index ? (
                <CircleCheck className="size-5 text-flame" />
              ) : (
                <span className="size-4 rounded-full border border-ink/25" />
              )}
            </span>
            <span className={revealed > index ? "" : "opacity-50"}>
              <strong className="block text-sm">{item.label}</strong>
              <span className="numeric text-xs text-muted">{item.value}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-6 min-h-24">
        {isReady ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <p className="text-sm font-bold">Your commute reality is ready to review.</p>
            <ActionButton className="mt-3 w-full" onClick={startReveal} disabled={isRevealing}>
              {isRevealing ? "Revealing your reality…" : "View my commute reality"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </ActionButton>
          </motion.div>
        ) : (
          <p className="pt-3 text-xs font-bold text-muted" aria-live="polite">
            {revealed === 3 ? "Finishing your analysis…" : "Reviewing your route, time, and fares…"}
          </p>
        )}
      </div>

      <button type="button" className="back-link mx-auto mt-3" onClick={onBack}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to offer
      </button>

      <p role="status" className="sr-only">
        {isReady ? "Your commute reality is ready." : "Calculating your commute-adjusted result."}
      </p>

      <AnimatePresence>
        {isRevealing && (
          <motion.div
            className="fixed inset-0 z-[80] grid place-items-center overflow-hidden bg-ink px-6 text-paper"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.24 }}
            role="status"
            aria-live="polite"
          >
            <motion.div
              className="relative z-10 max-w-lg text-center"
              initial={{ opacity: 0, scale: 0.9, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.58, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
            >
              <motion.span
                className="mx-auto grid size-16 place-items-center rounded-full border border-paper/25 bg-paper/10"
                initial={{ scale: 0.5, rotate: -18 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ duration: 0.62, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
                aria-hidden="true"
              >
                <RouteIcon className="size-6 text-mint" />
              </motion.span>
              <p className="mt-6 text-[0.68rem] font-black tracking-[0.18em] text-mint uppercase">
                Route + offer combined
              </p>
              <p className="mt-2 font-headline text-4xl leading-[0.95] font-black tracking-[-0.045em] sm:text-5xl">
                Your commute reality
              </p>
              <p className="mt-3 text-sm text-paper/70">
                Turning the headline salary into the full story.
              </p>
              <div
                className="mx-auto mt-7 h-1 w-48 overflow-hidden rounded-full bg-paper/15"
                aria-hidden="true"
              >
                <motion.div
                  className="h-full origin-left rounded-full bg-mint"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.95, delay: 0.18, ease: "easeInOut" }}
                />
              </div>
            </motion.div>
            <motion.div
              className="absolute size-[34rem] rounded-full border border-paper/10"
              initial={{ scale: 0.35, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
              aria-hidden="true"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
