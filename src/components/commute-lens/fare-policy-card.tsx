"use client";

import { motion } from "motion/react";
import { Gavel, TrendingUp } from "lucide-react";
import { Eyebrow } from "@/components/ui/typography";
import type { FarePolicyImpact } from "@/domain/fare";
import { formatPeso, modeLabel } from "./format";

/**
 * Fare policy watch.
 *
 * A regulator can approve a fare increase that never takes effect. The March
 * 2026 jeepney increase was approved and suspended within a day, so commuters
 * are still paying the older rate. This card prices the difference: what the
 * commute costs today, and what it costs if the suspension lifts.
 *
 * Only modes with a rate we could source are modelled, and the card says so
 * rather than implying the figure covers the whole journey.
 */
export function FarePolicyCard({
  impact,
  reduceMotion,
}: {
  impact: FarePolicyImpact;
  reduceMotion: boolean;
}) {
  const modes = impact.affectedModes.map(modeLabel).join(" and ");

  return (
    <motion.section
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="app-panel p-5 sm:p-6 print:hidden"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>Fare policy watch</Eyebrow>
          <h3 className="mt-2 max-w-md font-headline text-xl leading-tight font-black tracking-[-0.025em]">
            A suspended fare increase is waiting on this route.
          </h3>
        </div>
        <span className="status-chip" data-tone="caution">
          <Gavel className="size-3.5 shrink-0" aria-hidden="true" />
          Approved · not in force
        </span>
      </div>

      <p className="mt-4 text-[0.95rem] leading-relaxed">
        Your {modes} {impact.affectedModes.length === 1 ? "leg is" : "legs are"} priced at the rate
        in force today. If the suspended increase takes effect, this commute costs{" "}
        <strong className="numeric font-black text-flame">
          {formatPeso(Math.abs(impact.monthlyDelta))} more every month
        </strong>
        .
      </p>

      <dl className="mt-5 grid gap-4 border-t border-ink/10 pt-4 min-[420px]:grid-cols-3">
        <div>
          <dt className="text-[0.6rem] font-black tracking-[0.12em] text-muted uppercase">
            In force today
          </dt>
          <dd className="numeric mt-1 font-headline text-xl font-black">
            {formatPeso(impact.inForceMonthlyFare)}
          </dd>
        </div>
        <div>
          <dt className="text-[0.6rem] font-black tracking-[0.12em] text-muted uppercase">
            If unsuspended
          </dt>
          <dd className="numeric mt-1 font-headline text-xl font-black text-flame">
            {formatPeso(impact.proposedMonthlyFare)}
          </dd>
        </div>
        <div>
          <dt className="text-[0.6rem] font-black tracking-[0.12em] text-muted uppercase">
            Per one-way trip
          </dt>
          <dd className="numeric mt-1 flex items-center gap-1.5 font-headline text-xl font-black">
            <TrendingUp className="size-4 shrink-0 text-flame" aria-hidden="true" />+
            {formatPeso(Math.abs(impact.oneWayDelta))}
          </dd>
        </div>
      </dl>

      <p className="mt-4 border-t border-ink/10 pt-3.5 text-[0.72rem] leading-relaxed text-muted">
        {impact.citation.note} Source: {impact.citation.authority} —{" "}
        {impact.citation.reference.toLowerCase()}. Rates last checked{" "}
        <span className="numeric">{impact.ratesCheckedOn}</span>. Only jeepney-class legs are
        modelled here; changes approved for other vehicle types are not included.
      </p>
    </motion.section>
  );
}
