"use client";

import { ArrowLeft, ArrowRight, BadgePercent, Clock3, Repeat, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import type { FareConfirmationSummary } from "@/application/fare-confirmation/fare-confirmation.service";
import { ActionButton } from "@/components/ui/action-button";
import { Eyebrow } from "@/components/ui/typography";
import { describeFareDiscount, type FareDiscountClass } from "@/domain/fare";
import type { CommuteRoute, Location } from "@/domain/models";
import { formatMinutes, formatPeso, shortPlace, transferLabel } from "./format";
import { JourneyStory } from "./journey-story";
import { describeRouteStatus, reliabilityLabel, routeStatusMeaning } from "./provenance";
import { RouteMap } from "./route-map";
import { RouteStatusBadge } from "./route-status-badge";

function Fact({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="p-5">
      <dt className="flex items-center gap-2 text-[0.62rem] font-black tracking-[0.16em] text-muted uppercase">
        <span aria-hidden="true" className="text-flame [&>svg]:size-3.5">
          {icon}
        </span>
        {label}
      </dt>
      <dd className="mt-2">
        <span className="numeric block font-headline text-[1.75rem] leading-none font-black tracking-[-0.03em]">
          {value}
        </span>
        <span className="mt-1.5 block text-[0.7rem] leading-snug text-muted">{detail}</span>
      </dd>
    </div>
  );
}

/**
 * Stage two. The route stops being a lookup result and becomes a story with
 * four grouped facts, one honest provenance badge, and a map.
 */
export function RoutePreviewStage({
  origin,
  destination,
  route,
  fareClass,
  reduceMotion,
  fareConfirmations,
  onConfirmFare,
  onBack,
  onContinue,
}: {
  origin: Location;
  destination: Location;
  route: CommuteRoute;
  fareClass: FareDiscountClass;
  reduceMotion: boolean;
  fareConfirmations: readonly FareConfirmationSummary[];
  onConfirmFare: (segmentIndex: number, observedFare: number) => Promise<string | null>;
  onBack: () => void;
  onContinue: () => void;
}) {
  const status = describeRouteStatus(route);
  const fareDiscount = describeFareDiscount(fareClass);

  return (
    <div className="mx-auto max-w-4xl pt-6 lg:pt-10">
      <button type="button" className="back-link" onClick={onBack}>
        <ArrowLeft className="size-4" aria-hidden="true" /> Edit commute
      </button>

      <header className="mt-5">
        <Eyebrow>Step two · we found a way there</Eyebrow>
        <h1 className="mt-3 font-headline text-[clamp(2.1rem,6vw,4rem)] leading-[0.92] font-black tracking-[-0.05em]">
          {shortPlace(origin.label)}{" "}
          <span className="font-highlight font-normal text-accent italic">to</span>{" "}
          {shortPlace(destination.label)}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          This is one realistic way to make the trip. Check that it matches how you would actually
          travel — every peso and hour on the next screen comes from it.
        </p>
      </header>

      <section className="app-panel mt-7 overflow-hidden">
        <dl className="grid divide-y divide-ink/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Fact
            icon={<Clock3 />}
            label="One way"
            value={formatMinutes(route.oneWayDurationMinutes)}
            detail="Door to door, from the itinerary"
          />
          <Fact
            icon={<Wallet />}
            label="One-way fare"
            value={formatPeso(route.oneWayFare)}
            detail="Estimated, counted twice each office day"
          />
          <Fact
            icon={<Repeat />}
            label="Transfers"
            value={transferLabel(route.transfers)}
            detail={`${reliabilityLabel(route.reliability)} reported by the route provider`}
          />
        </dl>
        <div className="flex flex-wrap items-start gap-3 border-t border-ink/10 bg-canvas/60 p-5">
          <RouteStatusBadge status={status} />
          {fareDiscount.rate > 0 && (
            <span className="status-chip" data-tone="neutral">
              <BadgePercent className="size-3.5 shrink-0" aria-hidden="true" />
              {fareDiscount.shortLabel} · −{Math.round(fareDiscount.rate * 100)}%
            </span>
          )}
          <p className="min-w-0 flex-1 text-[0.72rem] leading-relaxed text-muted">
            {routeStatusMeaning(status.kind)} Fares are priced per leg from an estimated road
            distance, using the LTFRB jeepney matrix where it applies and estimated bands elsewhere.
          </p>
        </div>
      </section>

      <div className="mt-5">
        <JourneyStory
          route={route}
          reduceMotion={reduceMotion}
          fareConfirmations={fareConfirmations}
          onConfirmFare={onConfirmFare}
        />
      </div>

      <div className="mt-5">
        <RouteMap route={route} />
      </div>

      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ActionButton variant="secondary" onClick={onBack}>
          Try different locations
        </ActionButton>
        <div className="sm:text-right">
          <ActionButton className="w-full sm:w-auto" onClick={onContinue}>
            This is my route
            <ArrowRight className="size-4" aria-hidden="true" />
          </ActionButton>
          <p className="mt-2 text-[0.68rem] text-muted">
            Next: salary, hours, and how many days you would be onsite.
          </p>
        </div>
      </div>
    </div>
  );
}
