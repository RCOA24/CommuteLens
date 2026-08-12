"use client";

import { CheckCircle2, HandCoins, LoaderCircle, UsersRound } from "lucide-react";
import { useId, useState } from "react";
import type { FareConfirmationSummary } from "@/application/fare-confirmation/fare-confirmation.service";
import { formatPeso } from "./format";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric" }).format(
    new Date(value),
  );
}

/**
 * One small, explicit contribution point for a fare-bearing journey leg.
 * Individual reports never replace the displayed estimate; the server returns
 * only an aggregate once a minimum report count is reached.
 */
export function FareConfirmationControl({
  summary,
  onConfirm,
}: {
  summary?: FareConfirmationSummary;
  onConfirm: (observedFare: number) => Promise<string | null>;
}) {
  const fieldId = useId();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const isConfirmed = summary?.status === "community-submitted";

  async function submit() {
    if (!/^\d+$/.test(amount)) {
      setError("Enter the whole-peso fare you paid.");
      return;
    }
    setLoading(true);
    setError(null);
    const message = await onConfirm(Number(amount));
    setLoading(false);
    if (message) {
      setError(message);
      return;
    }
    setSubmitted(true);
    setAmount("");
  }

  return (
    <div className="mt-3 basis-full rounded-[0.9rem] border border-paper/15 bg-paper/5 px-3 py-2.5 text-[0.7rem] leading-relaxed text-paper/70">
      {isConfirmed ? (
        <p className="flex items-start gap-2 text-mint">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            <strong className="font-black">
              Community-submitted typical fare: {formatPeso(summary.typicalFare ?? 0)}.
            </strong>{" "}
            {summary.reportCount} submissions · {formatPeso(summary.reportedFareRange?.low ?? 0)}–
            {formatPeso(summary.reportedFareRange?.high ?? 0)} · last confirmed{" "}
            {summary.lastConfirmedAt ? formatDate(summary.lastConfirmedAt) : "recently"}.
          </span>
        </p>
      ) : (
        <p className="flex items-start gap-2">
          <UsersRound className="mt-0.5 size-3.5 shrink-0 text-mint" aria-hidden="true" />
          <span>
            {summary && summary.reportCount > 0
              ? `${summary.reportCount} of 5 reports collected. Help confirm this estimated fare.`
              : "Help confirm this estimated fare for other commuters."}
          </span>
        </p>
      )}

      <details className="mt-2">
        <summary className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 font-black text-mint">
          <HandCoins className="size-3.5" aria-hidden="true" />
          {isConfirmed ? "Confirm your fare too" : "Confirm fare"}
        </summary>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1" htmlFor={fieldId}>
            <span className="sr-only">Whole-peso fare paid for this leg</span>
            <input
              id={fieldId}
              className="min-h-9 w-full rounded-lg border border-paper/25 bg-paper px-2.5 text-sm font-bold text-ink"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={amount}
              placeholder="Fare paid, e.g. 15"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${fieldId}-error` : undefined}
              onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))}
            />
          </label>
          <button
            type="button"
            className="min-h-9 rounded-lg bg-mint px-3 text-[0.68rem] font-black text-ink disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void submit()}
            disabled={loading}
          >
            {loading ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-label="Submitting" />
            ) : (
              "Send"
            )}
          </button>
        </div>
        <p className="mt-2 text-[0.62rem] leading-relaxed text-paper/55">
          Only an opaque, session-only aggregate count is kept. Submissions are not independently
          verified and do not change this calculation.
        </p>
        {submitted && !error && (
          <p className="mt-2 text-[0.65rem] font-bold text-mint">Fare confirmation received.</p>
        )}
        {error && (
          <p
            id={`${fieldId}-error`}
            role="alert"
            className="mt-2 text-[0.65rem] font-bold text-[#ffc2b1]"
          >
            {error}
          </p>
        )}
      </details>
    </div>
  );
}
