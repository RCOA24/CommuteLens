"use client";

import { AnimatePresence, motion } from "motion/react";
import { Equal, LoaderCircle, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { SliderField } from "@/components/ui/slider-field";
import { Eyebrow } from "@/components/ui/typography";
import type { JobScenario, JobScenarioDelta } from "@/domain/job/scenario";
import {
  dayWord,
  formatHours,
  formatHoursDelta,
  formatPeso,
  formatPesoDelta,
  scheduleLabel,
} from "./format";

const TICKS = ["0", "1", "2", "3", "4", "5"] as const;

/**
 * The what-if control.
 *
 * The slider only ever changes one thing — office days a week — and the line
 * underneath states the consequence in the two units people actually feel:
 * pesos and hours. The delta itself comes from `diffJobScenarios` in the domain
 * layer, so this component never subtracts anything.
 */
export function ScenarioExplorer({
  baselineDays,
  scenario,
  delta,
  scenarioDays,
  onChange,
  routeState,
  reduceMotion,
}: {
  baselineDays: number;
  scenario: JobScenario;
  delta: JobScenarioDelta;
  scenarioDays: number;
  onChange: (days: number) => void;
  routeState: "idle" | "loading" | "error";
  reduceMotion: boolean;
}) {
  const dayDelta = delta.onsiteDaysPerWeek;
  const magnitude = Math.abs(dayDelta);

  return (
    <section className="mint-panel p-5 sm:p-7 print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>What if the week changed?</Eyebrow>
          <h2 className="mt-2 font-headline text-2xl leading-none font-black tracking-[-0.03em]">
            Move the office days.
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink/70">
            You entered {baselineDays} {dayWord(baselineDays)} a week. Drag to see what a different
            arrangement would be worth.
          </p>
        </div>
        <span className="rounded-full bg-paper px-3 py-1.5 text-[0.65rem] font-black tracking-[0.08em] uppercase">
          {scheduleLabel(scenarioDays)}
        </span>
      </div>

      <SliderField
        className="mt-6"
        label="Office days per week"
        value={scenarioDays}
        min={0}
        max={5}
        onChange={onChange}
        valueLabel={scenarioDays === 0 ? "Remote" : `${scenarioDays} ${dayWord(scenarioDays)}`}
        ticks={TICKS}
      />

      {/* A fixed minimum height keeps the panel from resizing as the copy changes. */}
      <div className="mt-4 min-h-[3.25rem]">
        {routeState === "loading" && (
          <p role="status" className="flex items-center gap-2 text-sm font-bold text-ink/70">
            <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
            Finding a route for this onsite scenario…
          </p>
        )}
        {routeState === "error" && (
          <p role="alert" className="text-sm font-bold text-danger">
            No route could be found, so onsite values are unavailable. Go back to inputs and check
            the locations.
          </p>
        )}
        {routeState === "idle" && (
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={dayDelta}
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: reduceMotion ? 0.01 : 0.22 }}
              className="text-[0.95rem] leading-relaxed"
            >
              {dayDelta === 0 ? (
                <>This is the schedule you entered. Move the slider to compare against it.</>
              ) : dayDelta < 0 ? (
                <>
                  {magnitude === 1 ? "One fewer office day" : `${magnitude} fewer office days`}{" "}
                  gives back{" "}
                  <strong className="numeric font-black">
                    {formatPeso(Math.abs(delta.incomeAfterCommute))}
                  </strong>{" "}
                  and{" "}
                  <strong className="numeric font-black">
                    {formatHours(Math.abs(delta.monthlyCommuteHours))}
                  </strong>{" "}
                  every month.
                </>
              ) : (
                <>
                  {magnitude === 1 ? "One more office day" : `${magnitude} more office days`} costs{" "}
                  <strong className="numeric font-black">
                    {formatPeso(Math.abs(delta.incomeAfterCommute))}
                  </strong>{" "}
                  and{" "}
                  <strong className="numeric font-black">
                    {formatHours(Math.abs(delta.monthlyCommuteHours))}
                  </strong>{" "}
                  every month.
                </>
              )}
            </motion.p>
          </AnimatePresence>
        )}
      </div>

      {routeState === "idle" && (
        <dl className="mt-5 grid gap-4 border-t border-ink/15 pt-5 min-[420px]:grid-cols-3">
          <ScenarioMetric
            label="Cash after transport"
            value={formatPeso(scenario.incomeAfterCommute)}
            delta={dayDelta === 0 ? null : formatPesoDelta(delta.incomeAfterCommute)}
            direction={signOf(delta.incomeAfterCommute)}
          />
          <ScenarioMetric
            label="Transport cost"
            value={formatPeso(scenario.monthlyFare)}
            delta={dayDelta === 0 ? null : formatPesoDelta(delta.monthlyFare)}
            direction={signOf(-delta.monthlyFare)}
          />
          <ScenarioMetric
            label="Commute time"
            value={formatHours(scenario.monthlyCommuteHours)}
            delta={dayDelta === 0 ? null : formatHoursDelta(delta.monthlyCommuteHours)}
            direction={signOf(-delta.monthlyCommuteHours)}
          />
        </dl>
      )}
    </section>
  );
}

function signOf(value: number): "up" | "down" | "flat" {
  if (Math.abs(value) < 0.005) return "flat";
  return value > 0 ? "up" : "down";
}

function ScenarioMetric({
  label,
  value,
  delta,
  direction,
}: {
  label: string;
  value: string;
  delta: string | null;
  /** Whether this change is an improvement, framed per metric. */
  direction: "up" | "down" | "flat";
}) {
  const icon: ReactNode =
    direction === "up" ? (
      <TrendingUp className="size-3" aria-hidden="true" />
    ) : direction === "down" ? (
      <TrendingDown className="size-3" aria-hidden="true" />
    ) : (
      <Equal className="size-3" aria-hidden="true" />
    );

  return (
    <div className="min-w-0">
      <dt className="text-[0.6rem] font-black tracking-[0.12em] text-ink/60 uppercase">{label}</dt>
      <dd>
        <strong className="numeric mt-1 block font-headline text-xl leading-none font-black sm:text-2xl">
          {value}
        </strong>
        {delta && (
          <span
            className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.62rem] font-black ${
              direction === "up"
                ? "bg-leaf/15 text-leaf"
                : direction === "down"
                  ? "bg-danger/12 text-danger"
                  : "bg-ink/8 text-ink/70"
            }`}
          >
            {icon}
            <span className="numeric">{delta}</span>
            <span className="sr-only">
              {direction === "up" ? "better than" : direction === "down" ? "worse than" : "same as"}{" "}
              your entered schedule
            </span>
          </span>
        )}
      </dd>
    </div>
  );
}
