"use client";

import { Bookmark, ChevronDown, Trash2, X } from "lucide-react";
import type {
  CommuterMemoryRecord,
  CommuterProfile,
  OfferLedgerEntry,
} from "@/application/commuter-profile/memory";
import { ActionButton } from "@/components/ui/action-button";
import { Eyebrow } from "@/components/ui/typography";
import type { CommuterMemoryState } from "@/hooks/use-commuter-profile";
import { formatNumber, formatPeso, shortPlace } from "./format";

/**
 * The commuter memory surface.
 *
 * Memory is the one feature here that retains something after the tab closes, so
 * it is built to be audited: where it is stored, exactly what is stored, and a
 * delete control that reports whether the deletion actually happened.
 */

const STORAGE_LABEL: Record<CommuterMemoryState["storage"], string> = {
  backboard: "Stored in Backboard memory, behind an anonymous key held only by this browser.",
  "session-only":
    "Stored in this server's memory for the current session only. It disappears on restart.",
  none: "Saving is switched off in this build, so nothing is retained.",
};

const ARRANGEMENT_LABEL: Record<NonNullable<CommuterProfile["workArrangement"]>, string> = {
  onsite: "Onsite",
  hybrid: "Hybrid",
  remote: "Remote",
};

/** Shown at the start of the journey when a previous setup exists. */
export function RememberedSetupBanner({
  profile,
  onApply,
  onForget,
}: {
  profile: CommuterProfile;
  onApply: () => void;
  onForget: () => void;
}) {
  return (
    <section className="app-panel mx-auto mt-4 max-w-5xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {/* Not tone="mint": pale mint on paper measures ~1.3:1. See globals.css. */}
          <Eyebrow tone="flame">Welcome back</Eyebrow>
          <h2 className="mt-2 font-headline text-lg font-black tracking-[-0.02em]">
            We remembered your last setup
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            {describeProfile(profile)} Saved{" "}
            {new Date(profile.updatedAt).toLocaleDateString("en-PH", {
              day: "numeric",
              month: "short",
            })}
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={onApply}>Use it</ActionButton>
          <ActionButton variant="quiet" onClick={onForget}>
            <Trash2 className="size-4" aria-hidden="true" /> Delete
          </ActionButton>
        </div>
      </div>
    </section>
  );
}

export function CommuterMemoryPanel({
  memory,
  onRememberSetup,
  onRememberOffer,
  onForgetOffer,
  onForgetAll,
}: {
  memory: CommuterMemoryState;
  onRememberSetup: () => void;
  onRememberOffer: (() => void) | null;
  onForgetOffer: (offerId: string) => void;
  onForgetAll: () => void;
}) {
  const isBusy = memory.status === "loading";
  const hasStored = memory.profile !== null || memory.offers.length > 0;

  return (
    <section className="app-panel mx-auto mt-6 max-w-5xl p-5 sm:p-6 print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Eyebrow tone="flame">Your commute file</Eyebrow>
          <h2 className="mt-2 flex items-center gap-2 font-headline text-lg font-black tracking-[-0.02em]">
            <Bookmark className="size-4 shrink-0 text-flame" aria-hidden="true" />
            Remember this for next time
          </h2>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted">
            Keep your home area, fare entitlement, and working assumptions so the next offer starts
            filled in — and keep each analyzed offer as a running shortlist instead of comparing two
            at a time. {STORAGE_LABEL[memory.storage]}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={onRememberSetup} disabled={isBusy}>
            {memory.profile ? "Update my setup" : "Remember my setup"}
          </ActionButton>
          {onRememberOffer && (
            <ActionButton variant="secondary" onClick={onRememberOffer} disabled={isBusy}>
              Add this offer
            </ActionButton>
          )}
        </div>
      </div>

      <p
        role="status"
        aria-live="polite"
        className={`mt-3 text-sm leading-relaxed ${
          memory.status === "error" ? "font-bold text-flame" : "text-muted"
        }`}
      >
        {isBusy
          ? "Saving…"
          : (memory.message ?? <span className="sr-only">Nothing saved yet.</span>)}
      </p>

      {memory.offers.length > 0 && (
        <div className="mt-4 border-t border-ink/10 pt-4">
          <Eyebrow className="text-ink">Remembered shortlist</Eyebrow>
          <ul className="mt-3 grid gap-2.5">
            {memory.offers.map((offer) => (
              <li key={`${offer.id}-${offer.analyzedAt}`} className="app-inset flex gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <OfferLedgerRow offer={offer} />
                </div>
                <button
                  type="button"
                  onClick={() => onForgetOffer(offer.id)}
                  disabled={isBusy}
                  className="grid size-11 shrink-0 place-items-center self-start rounded-full text-muted transition-colors hover:bg-ink/6 hover:text-flame disabled:opacity-50"
                  aria-label={`Remove ${offer.title} at ${offer.company} from the shortlist`}
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-[0.7rem] leading-relaxed text-muted">
            Every figure here was calculated by Commute Lens when the offer was analyzed, using the
            same engines as the receipt above.
          </p>
        </div>
      )}

      {hasStored && (
        <details className="mt-4 border-t border-ink/10 pt-3">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-xs font-black tracking-[0.08em] uppercase">
            Exactly what is stored
            <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
          </summary>
          <StoredRecords records={memory.records} />
          <div className="mt-3 border-t border-ink/10 pt-3">
            <ActionButton variant="quiet" onClick={onForgetAll} disabled={isBusy}>
              <Trash2 className="size-4" aria-hidden="true" /> Delete everything stored
            </ActionButton>
            <p className="mt-1.5 text-[0.7rem] leading-relaxed text-muted">
              Removes your saved setup and the whole shortlist. We will tell you whether the
              deletion actually went through.
            </p>
          </div>
        </details>
      )}
    </section>
  );
}

function OfferLedgerRow({ offer }: { offer: OfferLedgerEntry }) {
  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="min-w-0 text-sm font-bold break-words">
          {offer.title} · {offer.company}
        </p>
        <p className="numeric text-sm font-black">{formatPeso(offer.incomeAfterCommute)}</p>
      </div>
      <p className="numeric mt-1 text-xs leading-relaxed text-muted">
        {shortPlace(offer.officeLabel)} · {offer.onsiteDaysPerWeek} office day
        {offer.onsiteDaysPerWeek === 1 ? "" : "s"} · {formatPeso(offer.effectiveHourlyValue)} per
        effective hour · {formatNumber(offer.monthlyCommuteHours)} commute hrs/mo
      </p>
    </>
  );
}

function StoredRecords({ records }: { records: readonly CommuterMemoryRecord[] }) {
  if (records.length === 0) {
    return <p className="pb-1 text-xs text-muted">Nothing is stored yet.</p>;
  }
  return (
    <ul className="grid gap-2 pb-1">
      {records.map((record) => (
        <li
          key={record.id}
          className="overflow-x-auto rounded-[0.75rem] bg-ink/5 p-2.5 font-mono text-[0.65rem] leading-relaxed break-all whitespace-pre-wrap"
        >
          {record.content}
        </li>
      ))}
    </ul>
  );
}

function describeProfile(profile: CommuterProfile): string {
  const parts: string[] = [];
  if (profile.homeLabel) parts.push(`Home near ${shortPlace(profile.homeLabel)}`);
  if (profile.workArrangement) parts.push(ARRANGEMENT_LABEL[profile.workArrangement]);
  if (profile.workingHoursPerDay) parts.push(`${profile.workingHoursPerDay} paid hrs/day`);
  if (profile.fareClass && profile.fareClass !== "regular") {
    parts.push(`${profile.fareClass} fare`);
  }
  return parts.length > 0 ? `${parts.join(" · ")}.` : "A saved set of planning assumptions.";
}
