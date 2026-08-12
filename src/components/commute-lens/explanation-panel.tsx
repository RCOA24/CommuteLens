"use client";

import { LoaderCircle, MessageSquareQuote, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { ExplainResult } from "@/app/api/explain/route";
import type { ExplainRequest } from "@/shared/contracts/explanation";
import { ActionButton } from "@/components/ui/action-button";
import { Eyebrow } from "@/components/ui/typography";

/**
 * Plain-language explanation of a result.
 *
 * The request sends inputs, never conclusions, and the server re-runs the
 * deterministic engines before asking a model for prose. Whatever comes back is
 * labelled: an AI answer is only shown after it has been checked against the
 * calculated facts, and a deterministic fallback says so plainly.
 */
export function ExplanationPanel({
  payload,
  prompt,
  className = "",
}: {
  payload: ExplainRequest;
  prompt: string;
  className?: string;
}) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [source, setSource] = useState<"ai" | "deterministic" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function explain() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as ExplainResult;
      if (!result.success) throw new Error(result.error.message);
      setExplanation(result.data.text);
      setSource(result.data.source);
    } catch (explainError) {
      setError(
        explainError instanceof Error ? explainError.message : "Explanation is unavailable.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={`app-panel p-5 sm:p-6 print:hidden ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Eyebrow>In plain words</Eyebrow>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted">{prompt}</p>
        </div>
        <ActionButton variant="secondary" onClick={() => void explain()} disabled={loading}>
          {loading ? (
            <>
              <LoaderCircle className="size-3.5 motion-safe:animate-spin" aria-hidden="true" />
              Writing…
            </>
          ) : (
            <>
              <MessageSquareQuote className="size-3.5" aria-hidden="true" />
              {explanation ? "Rewrite it" : "Explain this"}
            </>
          )}
        </ActionButton>
      </div>

      <div aria-live="polite">
        {explanation && (
          <div className="mt-4 rounded-[1.1rem] bg-mint/50 p-4">
            <p className="text-sm leading-relaxed">{explanation}</p>
            <p className="mt-3 flex items-center gap-1.5 text-[0.62rem] font-black tracking-[0.1em] text-ink/70 uppercase">
              <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
              {source === "ai"
                ? "AI wording · checked against the calculated numbers"
                : "Written from the calculated numbers, no AI involved"}
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
