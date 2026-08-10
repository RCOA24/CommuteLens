import type { ExplanationProvider } from "@/providers/ai/explanation-provider";
import { ExplanationProviderError } from "@/providers/ai/explanation-provider";
import { buildDeterministicExplanation } from "./deterministic-explanation";
import type { ExplanationFacts } from "./facts";
import { findGuardrailViolations, type GuardrailViolation } from "./guardrails";

/**
 * CL-010 — explanation use case.
 *
 * Contract: this never fails. AI is an enhancement, so every failure path
 * returns the deterministic explanation and reports why AI was not used. The
 * caller can always render `text`.
 */

export type ExplanationSource = "ai" | "deterministic";

export interface Explanation {
  text: string;
  source: ExplanationSource;
  /** Present when AI was attempted but not used. Safe to log and display. */
  degradedReason?:
    "not-configured" | "timeout" | "upstream" | "malformed" | "guardrail" | "unknown";
  /** Populated when the guardrails rejected generated text. For debugging only. */
  violations?: GuardrailViolation[];
}

export class ExplainAnalysisUseCase {
  constructor(private readonly provider: ExplanationProvider | null) {}

  async execute(facts: ExplanationFacts, signal?: AbortSignal): Promise<Explanation> {
    const deterministic = buildDeterministicExplanation(facts);

    if (!this.provider) {
      return { text: deterministic, source: "deterministic", degradedReason: "not-configured" };
    }

    let generated: string;
    try {
      generated = await this.provider.explain(facts, signal);
    } catch (error) {
      return {
        text: deterministic,
        source: "deterministic",
        degradedReason: error instanceof ExplanationProviderError ? error.reason : "unknown",
      };
    }

    const violations = findGuardrailViolations(generated, facts);
    if (violations.length > 0) {
      // Refuse the generated text outright rather than editing it. A partially
      // corrected explanation is harder to trust than a deterministic one.
      return {
        text: deterministic,
        source: "deterministic",
        degradedReason: "guardrail",
        violations,
      };
    }

    return { text: generated, source: "ai" };
  }
}
