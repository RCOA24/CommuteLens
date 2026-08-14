"use client";

import { LoaderCircle, MessageSquareQuote, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import type { ExplainResult } from "@/app/api/explain/route";
import type { ExplainRequest } from "@/shared/contracts/explanation";
import { ApiError, userFacingMessage } from "@/shared/security/safe-error";
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
      if (!result.success) throw new ApiError(result.error.message);
      setExplanation(result.data.text);
      setSource(result.data.source);
    } catch (explainError) {
      setError(
        userFacingMessage(
          explainError,
          "Explanation is unavailable. The figures above are unaffected.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className={`app-panel ai-module p-5 sm:p-6 print:hidden ${className}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <span className="ai-badge">
            <Sparkles className="size-3" aria-hidden="true" /> Optional AI
          </span>
          <Eyebrow className="mt-3">Plain-language coach</Eyebrow>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted">{prompt}</p>
          <p className="mt-2 max-w-lg text-[0.68rem] leading-relaxed text-muted">
            AI explains the calculated result. It cannot change salary, deductions, fare, time, or
            the selected route.
          </p>
        </div>
        <ActionButton
          className="w-full shrink-0 sm:w-auto"
          variant="secondary"
          onClick={() => void explain()}
          disabled={loading}
        >
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
