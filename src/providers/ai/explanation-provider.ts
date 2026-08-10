import type { ExplanationFacts } from "@/application/explain-analysis/facts";

export interface ExplanationProvider {
  /**
   * Returns natural-language prose describing the supplied calculated facts.
   * Implementations must not receive or return structured metrics.
   */
  explain(facts: ExplanationFacts, signal?: AbortSignal): Promise<string>;
}

/** Safe, non-leaking failure for any AI provider. */
export class ExplanationProviderError extends Error {
  constructor(
    message: string,
    readonly reason: "not-configured" | "timeout" | "upstream" | "malformed",
  ) {
    super(message);
    this.name = "ExplanationProviderError";
  }
}
