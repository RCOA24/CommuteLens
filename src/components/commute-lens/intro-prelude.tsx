"use client";

import { ArrowRight, MapPin, Navigation, Train } from "lucide-react";
import { motion } from "motion/react";
import { ActionButton } from "@/components/ui/action-button";
import { Eyebrow } from "@/components/ui/typography";

const benefits = ["Price the route", "Protect your time", "See the real offer"];

/**
 * A short, user-controlled entry moment before the first workflow step. It
 * does not use a timer so visitors can read it at their own pace, and all
 * movement reduces to a simple fade when their OS requests reduced motion.
 */
export function IntroPrelude({
  reduceMotion,
  onEnter,
}: {
  reduceMotion: boolean;
  onEnter: () => void;
}) {
  const transition = {
    duration: reduceMotion ? 0.08 : 0.7,
    ease: [0.22, 1, 0.36, 1] as const,
  };
  const reveal = (delay: number) => ({
    initial: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { ...transition, delay: reduceMotion ? 0 : delay },
  });

  return (
    <motion.section
      className="relative isolate min-h-[calc(100svh-8rem)] overflow-hidden rounded-[2rem] bg-ink px-6 py-8 text-paper shadow-[0_26px_80px_rgba(16,42,43,0.22)] sm:px-10 sm:py-12 lg:min-h-[660px] lg:px-14 lg:py-14"
      exit={
        reduceMotion
          ? { opacity: 0 }
          : { opacity: 0, scale: 1.12, filter: "blur(8px)" }
      }
      transition={{
        duration: reduceMotion ? 0.08 : 0.46,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_86%_18%,rgba(201,244,223,0.24),transparent_0_18%),radial-gradient(circle_at_16%_86%,rgba(200,63,22,0.22),transparent_0_20%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,253,244,0.42)_1px,transparent_1px)] [background-size:24px_24px]"
      />

      <div
        className="relative grid min-h-[inherit] items-center gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(390px,0.8fr)] lg:gap-16"
      >
        <div className="max-w-2xl py-4 lg:py-0">
          <motion.div {...reveal(0)}>
            <Eyebrow tone="mint">A clearer way to choose</Eyebrow>
          </motion.div>
          <motion.h1
            {...reveal(0.08)}
            className="mt-5 max-w-[10ch] font-headline text-[clamp(3.2rem,9vw,7.2rem)] leading-[0.82] font-black tracking-[-0.075em]"
          >
            See the <span className="text-mint">life</span> behind the offer.
          </motion.h1>
          <motion.p
            {...reveal(0.16)}
            className="mt-7 max-w-xl text-base leading-relaxed text-paper/72 sm:text-lg"
          >
            Commute Lens turns a salary and a route into the money, time, and everyday trade-offs
            that a job offer leaves out.
          </motion.p>

          <motion.ul {...reveal(0.24)} className="mt-8 flex flex-wrap gap-2.5">
            {benefits.map((benefit, index) => (
              <li
                key={benefit}
                className="flex items-center gap-2 rounded-full border border-paper/18 bg-paper/8 px-3.5 py-2 text-xs font-bold text-paper/88 backdrop-blur-sm"
              >
                {index === 0 ? (
                  <Navigation className="size-3.5 text-mint" aria-hidden="true" />
                ) : index === 1 ? (
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-mint" />
                ) : (
                  <Train className="size-3.5 text-mint" aria-hidden="true" />
                )}
                {benefit}
              </li>
            ))}
          </motion.ul>

          <motion.div {...reveal(0.32)} className="mt-9 flex flex-wrap items-center gap-4">
            <ActionButton variant="accent" className="min-w-52" onClick={onEnter}>
              Start with your trip
              <ArrowRight className="size-4" aria-hidden="true" />
            </ActionButton>
            <p className="max-w-xs text-xs leading-relaxed text-paper/58">
              A decision aid for transit, time, and take-home—not a promise of arrival or a safety
              score.
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 28 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ ...transition, delay: reduceMotion ? 0 : 0.18 }}
          className="relative mx-auto w-full max-w-[500px] lg:mx-0 lg:justify-self-end"
          aria-hidden="true"
        >
          <div className="absolute -inset-5 rounded-[2rem] border border-mint/25 bg-mint/8 blur-[1px]" />
          <div className="relative overflow-hidden rounded-[1.6rem] border border-paper/15 bg-paper p-4 text-ink shadow-[0_22px_55px_rgba(0,0,0,0.2)] sm:p-5">
            <div className="flex items-center justify-between gap-4 border-b border-ink/10 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-full bg-ink text-paper">
                  <Navigation className="size-4" />
                </span>
                <div>
                  <p className="text-[0.62rem] font-black tracking-[0.14em] text-muted uppercase">
                    Your route, in focus
                  </p>
                  <p className="font-headline text-base font-black tracking-[-0.02em]">
                    The complete offer
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-mint px-2.5 py-1 text-[0.6rem] font-black tracking-[0.1em] uppercase">
                Preview
              </span>
            </div>

            <div className="relative mt-5 rounded-[1.15rem] bg-canvas px-4 py-5 sm:px-5">
              <svg
                viewBox="0 0 360 155"
                fill="none"
                className="absolute inset-x-2 top-6 h-[calc(100%-3rem)] w-[calc(100%-1rem)]"
              >
                <motion.path
                  d="M48 32C100 34 103 115 168 100C235 85 215 29 310 51"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  className="text-ink/40"
                  initial={
                    reduceMotion
                      ? { pathLength: 1, opacity: 0.55 }
                      : { pathLength: 0, opacity: 0 }
                  }
                  animate={{ pathLength: 1, opacity: 0.55 }}
                  transition={{
                    duration: reduceMotion ? 0.08 : 1.1,
                    delay: reduceMotion ? 0 : 0.35,
                  }}
                />
              </svg>

              <div className="relative grid min-h-31 grid-cols-3 items-end gap-3 text-center">
                <RoutePoint
                  label="Home"
                  detail="Start"
                  delay={0.45}
                  reduceMotion={reduceMotion}
                />
                <RoutePoint
                  label="Transit"
                  detail="Route found"
                  delay={0.62}
                  reduceMotion={reduceMotion}
                  accent
                />
                <RoutePoint
                  label="Office"
                  detail="Arrive"
                  delay={0.79}
                  reduceMotion={reduceMotion}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2.5">
              <Insight label="Route" value="Ready" />
              <Insight label="Time" value="Visible" />
              <Insight label="Cash" value="Clear" />
            </div>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
}

function RoutePoint({
  label,
  detail,
  delay,
  reduceMotion,
  accent = false,
}: {
  label: string;
  detail: string;
  delay: number;
  reduceMotion: boolean;
  accent?: boolean;
}) {
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.86 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: reduceMotion ? 0.08 : 0.42, delay: reduceMotion ? 0 : delay }}
      className="relative z-10 flex flex-col items-center"
    >
      <span
        className={`grid size-9 place-items-center rounded-full ring-4 ring-canvas ${
          accent ? "bg-accent text-white" : "bg-ink text-paper"
        }`}
      >
        {accent ? <Train className="size-4" /> : <MapPin className="size-4" />}
      </span>
      <strong className="mt-2 text-[0.68rem] font-black tracking-[0.08em] uppercase">{label}</strong>
      <span className="mt-0.5 text-[0.63rem] text-muted">{detail}</span>
    </motion.div>
  );
}

function Insight({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[0.9rem] border border-ink/10 bg-canvas/60 px-2.5 py-3">
      <p className="text-[0.55rem] font-black tracking-[0.12em] text-muted uppercase">{label}</p>
      <p className="mt-1 font-headline text-sm font-black tracking-[-0.02em]">{value}</p>
    </div>
  );
}
