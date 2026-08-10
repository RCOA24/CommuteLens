import { permittedNumbers, type ExplanationFacts } from "./facts";

/**
 * CL-010 — output guardrails.
 *
 * The AI contract says it may explain calculated values and must not invent,
 * recalculate, or decide. Prompt instructions alone are not a control, so the
 * generated text is checked before it is ever returned:
 *
 *  1. Every number in the text must be one we supplied (or a small, harmless
 *     integer such as "5 days a week").
 *  2. It must not tell the user which job to take.
 *  3. It must be short enough to sit on a results card.
 */

export const MAX_EXPLANATION_LENGTH = 900;

/** Integers small enough to be ordinary prose ("two transfers", "8 hours"). */
const HARMLESS_INTEGER_MAX = 12;
const NUMERIC_TOLERANCE = 0.51;

const DECISION_PATTERNS: readonly RegExp[] = [
  /\byou should (?:take|accept|reject|decline|choose|pick)\b/i,
  /\bi recommend\b/i,
  /\bthe better (?:job|offer|choice) is\b/i,
  /\bgo with job [ab]\b/i,
  /\btake job [ab]\b/i,
];

export type GuardrailViolation =
  | { type: "unapproved-number"; value: number }
  | { type: "decision-language"; excerpt: string }
  | { type: "too-long"; length: number }
  | { type: "empty" };

export function findGuardrailViolations(
  text: string,
  facts: ExplanationFacts,
): GuardrailViolation[] {
  const violations: GuardrailViolation[] = [];
  const trimmed = text.trim();

  if (trimmed.length === 0) return [{ type: "empty" }];
  if (trimmed.length > MAX_EXPLANATION_LENGTH) {
    violations.push({ type: "too-long", length: trimmed.length });
  }

  for (const pattern of DECISION_PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match) violations.push({ type: "decision-language", excerpt: match[0] });
  }

  const allowed = permittedNumbers(facts).map(Math.abs);
  for (const value of extractNumbers(trimmed)) {
    const magnitude = Math.abs(value);
    if (Number.isInteger(magnitude) && magnitude <= HARMLESS_INTEGER_MAX) continue;
    const approved = allowed.some(
      (candidate) => Math.abs(candidate - magnitude) <= NUMERIC_TOLERANCE,
    );
    if (!approved) violations.push({ type: "unapproved-number", value });
  }

  return violations;
}

/** Pulls numeric tokens out of prose, tolerating thousands separators and currency. */
export function extractNumbers(text: string): number[] {
  const matches = text.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  return matches
    .map((token) => Number.parseFloat(token.replace(/,/g, "")))
    .filter((value) => Number.isFinite(value));
}
