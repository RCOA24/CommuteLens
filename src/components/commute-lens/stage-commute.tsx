"use client";

import {
  ArrowRight,
  Blend,
  Building2,
  Coins,
  House,
  LoaderCircle,
  Scale,
  Train,
} from "lucide-react";
import { LocationSearch } from "@/components/location/location-search";
import { ActionButton } from "@/components/ui/action-button";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { FormAlert } from "@/components/ui/fields";
import { Eyebrow } from "@/components/ui/typography";
import type { FareDiscountClass } from "@/domain/fare";
import type { Location, WorkArrangement } from "@/domain/models";
import { FareClassSelect } from "./fare-class-select";

const ARRANGEMENT_OPTIONS: readonly ChoiceOption<WorkArrangement>[] = [
  {
    value: "remote",
    title: "Remote",
    note: "No commute to price.",
    icon: <House />,
  },
  {
    value: "hybrid",
    title: "Hybrid",
    note: "Some office days each week.",
    icon: <Blend />,
  },
  {
    value: "onsite",
    title: "Onsite",
    note: "In the office every working day.",
    icon: <Building2 />,
  },
];

const PROMISES = [
  { icon: <Train />, label: "Real transit itineraries" },
  { icon: <Coins />, label: "Cost in pesos and hours" },
  { icon: <Scale />, label: "Two offers, side by side" },
];

/**
 * Stage one. The hero states the thesis and the panel asks for exactly three
 * things: where you start, where the office is, and how often you go.
 */
export function CommuteSetupStage({
  idPrefix,
  origin,
  destination,
  onOriginChange,
  onDestinationChange,
  arrangement,
  onArrangementChange,
  fareClass,
  onFareClassChange,
  isDiscovering,
  error,
  onContinue,
}: {
  idPrefix: string;
  origin: Location | null;
  destination: Location | null;
  onOriginChange: (location: Location | null) => void;
  onDestinationChange: (location: Location | null) => void;
  arrangement: WorkArrangement;
  onArrangementChange: (arrangement: WorkArrangement) => void;
  fareClass: FareDiscountClass;
  onFareClassChange: (fareClass: FareDiscountClass) => void;
  isDiscovering: boolean;
  error: string | null;
  onContinue: () => void;
}) {
  const isRemote = arrangement === "remote";
  const canContinue = Boolean(origin && destination) && !isDiscovering;

  return (
    <div className="grid min-w-0 items-center gap-10 pt-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.8fr)] lg:gap-14 lg:pt-14">
      <section className="min-w-0">
        <Eyebrow>Philippines-first job decision tool</Eyebrow>
        <h1 className="mt-4 max-w-[16ch] font-headline text-[clamp(2.6rem,7vw,5.4rem)] leading-[0.88] font-black tracking-[-0.055em]">
          Salary is the headline.
        </h1>
        <p className="mt-3 max-w-[22ch] font-highlight text-[clamp(2rem,5.2vw,3.6rem)] leading-[0.95] text-accent italic">
          Commute reality tells the full story.
        </p>
        <p className="mt-7 max-w-lg text-base leading-relaxed text-muted sm:text-lg">
          An offer costs money and time to reach. Commute Lens prices both, so you can compare what
          actually lands in your account and what your week really looks like.
        </p>
        <ul className="mt-8 flex flex-wrap gap-2.5">
          {PROMISES.map((promise) => (
            <li
              key={promise.label}
              className="flex items-center gap-2 rounded-full border border-ink/12 bg-paper/70 px-3.5 py-2 text-xs font-bold"
            >
              <span aria-hidden="true" className="text-flame [&>svg]:size-3.5">
                {promise.icon}
              </span>
              {promise.label}
            </li>
          ))}
        </ul>
      </section>

      <section className="app-panel min-w-0 p-5 sm:p-7">
        <Eyebrow>Step one · your trip</Eyebrow>
        <h2 className="mt-2 font-headline text-2xl font-black tracking-[-0.03em]">
          Where would this job take you?
        </h2>

        <div className="trip-rail mt-5">
          <div className="trip-leg" data-kind="origin">
            <span className="trip-leg-node" aria-hidden="true" />
            <LocationSearch
              value={origin}
              onChange={onOriginChange}
              label="FROM · WHERE YOU LIVE"
              placeholder="Search where you start, e.g. Cubao"
              idPrefix={`${idPrefix}-origin`}
            />
          </div>
          <div className="trip-leg" data-kind="destination">
            <span className="trip-leg-node" aria-hidden="true" />
            <LocationSearch
              value={destination}
              onChange={onDestinationChange}
              label="TO · THE OFFICE"
              placeholder="Search the office, e.g. BGC"
              idPrefix={`${idPrefix}-destination`}
              showCurrentLocation={false}
            />
          </div>
        </div>

        <ChoiceGroup
          className="mt-6"
          name={`${idPrefix}-arrangement`}
          legend="How often would you be onsite?"
          value={arrangement}
          options={ARRANGEMENT_OPTIONS}
          onChange={onArrangementChange}
        />

        {!isRemote && (
          <FareClassSelect
            className="mt-6"
            name={`${idPrefix}-fare-class`}
            value={fareClass}
            onChange={onFareClassChange}
          />
        )}

        {isRemote ? (
          <p className="mt-4 flex items-start gap-2.5 rounded-[1.1rem] border border-leaf/25 bg-leaf/8 p-3.5 text-xs leading-relaxed text-ink">
            <House className="mt-0.5 size-4 shrink-0 text-leaf" aria-hidden="true" />
            <span>
              <strong className="font-bold">No commute is required for this role.</strong> We will
              skip route discovery and go straight to the offer. The office stays on file so you can
              still explore what onsite days would cost later.
            </span>
          </p>
        ) : (
          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted">
            <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-flame" aria-hidden="true" />
            <span>
              Next we find a real transit itinerary for this trip. You review it, then add the
              salary.
            </span>
          </p>
        )}

        {error && (
          <div className="mt-4">
            <FormAlert>{error}</FormAlert>
          </div>
        )}

        <ActionButton className="mt-6 w-full" disabled={!canContinue} onClick={onContinue}>
          {isDiscovering ? (
            <>
              <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
              Finding your route…
            </>
          ) : (
            <>
              {isRemote ? "Continue without a route" : "Find my route"}
              <ArrowRight className="size-4" aria-hidden="true" />
            </>
          )}
        </ActionButton>
        {!origin || !destination ? (
          <p className="mt-2.5 text-center text-[0.68rem] text-muted">
            Pick both locations from the search results to continue.
          </p>
        ) : null}
      </section>
    </div>
  );
}
