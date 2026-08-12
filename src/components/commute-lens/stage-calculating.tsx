"use client";

import { motion } from "motion/react";
import { CircleCheck, Route as RouteIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { calculateCommute } from "@/domain/commute/calculations";
import type { CommuteRoute } from "@/domain/models";
import { formatNumber, formatPeso } from "./format";
import { Eyebrow } from "@/components/ui/typography";

/**
 * The pause between "calculate" and the reveal.
 *
 * It shows the three facts the result is built from, so the wait teaches
 * something instead of spinning. Progress is determinate â€” an endless spinner
 * is the repetitive decoration this redesign removed.
 */
export function CalculatingStage({
  route,
  onsiteDays,
  reduceMotion,
}: {
  route: CommuteRoute | null;
  onsiteDays: number;
  reduceMotion: boolean;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // With reduced motion the checklist is complete from the first paint, so
    // there is nothing to schedule and no state to set.
    if (reduceMotion) return;
    const timers = [260, 580, 860].map((ms, index) => setTimeout(() => setTick(index + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, [reduceMotion]);

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
        Pricing your commuteâ€¦
      </h1>

      <div className="mt-7 h-1 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
        <motion.div
          className="h-full origin-left rounded-full bg-accent"
          initial={{ scaleX: reduceMotion ? 1 : 0.05 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: reduceMotion ? 0 : 1.1, ease: "easeInOut" }}
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

      <p role="status" className="sr-only">
        Calculating your commute-adjusted result.
      </p>
    </div>
  );
}
