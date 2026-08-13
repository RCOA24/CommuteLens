"use client";

import { motion } from "motion/react";
import { Bike, Bus, Footprints, House, Milestone, Train } from "lucide-react";
import type { ReactNode } from "react";
import type { FareConfirmationSummary } from "@/application/fare-confirmation/fare-confirmation.service";
import type { CommuteRoute, TransportMode } from "@/domain/models";
import { FareConfirmationControl } from "./fare-confirmation-control";
import { formatPeso, modeLabel, shortPlace, transferLabel } from "./format";
import { describeRouteStatus } from "./provenance";
import { RouteStatusBadge } from "./route-status-badge";

function modeIcon(mode: TransportMode): ReactNode {
  switch (mode) {
    case "rail":
      return <Train />;
    case "walk":
      return <Footprints />;
    case "tricycle":
      return <Bike />;
    case "bus":
    case "jeepney":
    case "uv-express":
    case "p2p":
      return <Bus />;
    default:
      return <Milestone />;
  }
}

/**
 * The route as a journey rather than a table.
 *
 * One vertical rail serves every width. The previous desktop layout was a
 * fixed 680px diagram inside a horizontal scroller, which broke the "no
 * horizontal scrolling" rule on phones and small laptops alike; a rail reads
 * the same way transit apps do and grows gracefully instead.
 */
export function JourneyStory({
  route,
  reduceMotion,
  fareConfirmations = [],
  onConfirmFare,
}: {
  route: CommuteRoute;
  reduceMotion: boolean;
  fareConfirmations?: readonly FareConfirmationSummary[];
  onConfirmFare?: (segmentIndex: number, observedFare: number) => Promise<string | null>;
}) {
  const status = describeRouteStatus(route);
  const lastIndex = route.segments.length - 1;
  const hasTransitLeg = route.segments.some((segment) => segment.mode !== "walk");

  function reveal(index: number) {
    if (reduceMotion) return {};
    return {
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      transition: { delay: 0.08 + index * 0.09, duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
    };
  }

  return (
    <section className="ink-panel on-ink p-5 sm:p-7">
      {/* At-a-glance ribbon: the whole trip in one line, wrapping instead of scrolling. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-[0.68rem] font-black tracking-[0.1em] uppercase">
        <span className="flex items-center gap-1.5 rounded-full bg-mint px-2.5 py-1 text-ink">
          <House className="size-3" aria-hidden="true" />
          Home
        </span>
        {route.segments.map((segment, index) => (
          <span
            key={`ribbon-${index}`}
            className="flex items-center gap-1.5 text-paper/55"
            aria-hidden="true"
          >
            <span className="text-paper/30">→</span>
            <span className="flex items-center gap-1 [&>svg]:size-3">
              {modeIcon(segment.mode)}
              {modeLabel(segment.mode)}
            </span>
          </span>
        ))}
        <span aria-hidden="true" className="text-paper/30">
          →
        </span>
        <span className="flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-white">
          Office
        </span>
      </div>

      <ol className="mt-7" aria-label="Journey legs from home to office">
        <li className="relative flex gap-4 pb-5">
          <span
            aria-hidden="true"
            className="absolute top-9 bottom-0 left-[17px] w-px bg-paper/20"
          />
          <span className="grid size-9 shrink-0 place-items-center rounded-full border border-mint/40 text-mint">
            <House className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 pt-1">
            <p className="text-[0.62rem] font-black tracking-[0.16em] text-mint uppercase">
              Start · Home
            </p>
            <p className="mt-1 text-sm font-bold break-words">
              {route.segments[0]?.origin.label ?? "Your origin"}
            </p>
          </div>
        </li>

        {route.segments.map((segment, index) => {
          const isFinal = index === lastIndex;
          const confirmation = fareConfirmations.find((item) => item.segmentIndex === index);
          const canConfirm =
            onConfirmFare !== undefined && segment.mode !== "walk" && segment.estimatedFare > 0;
          return (
            <motion.li
              key={`${segment.origin.label}-${segment.destination.label}-${index}`}
              {...reveal(index)}
              className="relative flex gap-4 pb-5 last:pb-0"
            >
              {!isFinal && (
                <span
                  aria-hidden="true"
                  className="absolute top-9 bottom-0 left-[17px] w-px bg-paper/20"
                />
              )}
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-full ${
                  isFinal ? "bg-accent text-white" : "bg-mint text-ink"
                } [&>svg]:size-4`}
                aria-hidden="true"
              >
                {modeIcon(segment.mode)}
              </span>
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-1">
                <div className="min-w-0">
                  <p
                    className={`text-[0.62rem] font-black tracking-[0.16em] uppercase ${
                      isFinal ? "text-accent" : "text-paper/55"
                    }`}
                  >
                    {isFinal
                      ? `${modeLabel(segment.mode)} · Arrive office`
                      : modeLabel(segment.mode)}
                  </p>
                  <p className="mt-1 text-sm font-bold break-words">
                    {shortPlace(segment.destination.label)}
                  </p>
                </div>
                <p className="numeric shrink-0 text-xs font-bold text-paper/70">
                  {segment.estimatedDurationMinutes} min · {formatPeso(segment.estimatedFare)}
                </p>
                {canConfirm && (
                  <FareConfirmationControl
                    summary={confirmation}
                    onConfirm={(observedFare) => onConfirmFare(index, observedFare)}
                  />
                )}
              </div>
            </motion.li>
          );
        })}
      </ol>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-paper/15 pt-5">
        <p className="text-xs font-bold text-paper/65">
          {route.transfers === 0
            ? hasTransitLeg
              ? "No transit transfers counted · walking access or exit may still be included"
              : "Walking-only itinerary · no transit transfers counted"
            : `${transferLabel(route.transfers)} · fares estimated, not ticketed`}
        </p>
        <RouteStatusBadge status={status} surface="ink" />
      </div>
      {onConfirmFare && (
        <p className="mt-3 text-[0.64rem] leading-relaxed text-paper/50">
          Fare confirmations are optional. Only session-only aggregate counts are kept, and the
          estimated route total remains unchanged.
        </p>
      )}
    </section>
  );
}
