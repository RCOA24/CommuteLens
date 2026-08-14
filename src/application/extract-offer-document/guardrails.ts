import type { WorkArrangement } from "@/domain/models";
import type {
  ExtractedOfferFields,
  OfferExtractionEvidence,
  RawOfferExtraction,
  SalaryConversion,
  SalaryPeriod,
} from "./offer-extraction";

/**
 * Extraction guardrails.
 *
 * The model transcribes; this file decides what is usable. Three rules:
 *
 *  1. **We do the arithmetic.** A stated annual figure is divided here, never by
 *     the model, and the conversion is reported so the user can check it.
 *  2. **Implausible beats wrong.** A value outside a sane bound is dropped with a
 *     warning rather than corrected, because a silently repaired salary is worse
 *     than an empty field the user has to fill in.
 *  3. **Contradictions are dropped whole.** "Remote, 3 office days" is not
 *     resolvable, so neither half survives.
 */

const MAX_NAME_LENGTH = 80;
const MAX_ADDRESS_LENGTH = 180;
const MAX_QUOTE_LENGTH = 200;
const MAX_EVIDENCE_ENTRIES = 8;

/** PHP monthly bounds. Wide enough for real offers, tight enough to catch a misread. */
export const MIN_MONTHLY_SALARY = 1_000;
export const MAX_MONTHLY_SALARY = 5_000_000;

/** Currency tokens we accept as Philippine pesos. Anything else is refused. */
const PESO_TOKENS = ["php", "peso", "pesos", "₱", "p", "piso"];

/** Multipliers from a stated period to one month. 52/12 weeks per month. */
const MONTHLY_FACTOR: Record<Exclude<SalaryPeriod, "unknown">, number> = {
  monthly: 1,
  annual: 1 / 12,
  "semi-monthly": 2,
  "bi-weekly": 26 / 12,
  weekly: 52 / 12,
};

const EXTRACTABLE_FIELDS: readonly (keyof ExtractedOfferFields)[] = [
  "title",
  "company",
  "monthlySalary",
  "workArrangement",
  "onsiteDaysPerWeek",
  "workingDaysPerWeek",
  "workingHoursPerDay",
  "officeAddressQuery",
];

/**
 * Strips control characters and collapses whitespace so document text cannot
 * restructure a later prompt or smuggle markup into the form. Mirrors
 * `sanitizeFreeText` but takes an explicit length, because an address and a
 * quoted sentence need more room than a job title.
 */
export function sanitizeExtractedText(value: string, maxLength: number): string {
  return value
    .replace(/[\p{Cc}\p{Cf}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export interface GuardedExtraction {
  fields: ExtractedOfferFields;
  evidence: OfferExtractionEvidence[];
  warnings: string[];
  salaryConversion: SalaryConversion | null;
  /** Empty until `verifyAgainstSourceText` runs; there is nothing to check without source text. */
  unverifiedFields: (keyof ExtractedOfferFields)[];
}

export function applyExtractionGuardrails(raw: RawOfferExtraction): GuardedExtraction {
  const warnings: string[] = [];

  const title = optionalText(raw.title, MAX_NAME_LENGTH);
  const company = optionalText(raw.company, MAX_NAME_LENGTH);
  const officeAddressQuery = optionalText(raw.officeAddress, MAX_ADDRESS_LENGTH);

  const salary = resolveSalary(raw, warnings);
  const hours = resolveWorkingHours(raw.workingHoursPerDay, warnings);
  const schedule = resolveSchedule(raw, warnings);

  return {
    fields: {
      title,
      company,
      monthlySalary: salary?.monthlyAmount ?? null,
      workArrangement: schedule.workArrangement,
      onsiteDaysPerWeek: schedule.onsiteDaysPerWeek,
      workingDaysPerWeek: schedule.workingDaysPerWeek,
      workingHoursPerDay: hours,
      officeAddressQuery,
    },
    evidence: guardEvidence(raw.evidence),
    warnings,
    salaryConversion: salary && salary.statedPeriod !== "monthly" ? salary : null,
    unverifiedFields: [],
  };
}

/**
 * Checks a guarded extraction against the document it came from.
 *
 * This is only possible when the text was extracted locally, and it is the reason
 * the text path is preferred over handing the file to the reader. Two different
 * treatments, for two different risks:
 *
 *  - **A quote that is not in the document is deleted.** A fabricated citation is
 *    worse than no citation, because it manufactures confidence.
 *  - **A value that cannot be located is kept but flagged.** Letters legitimately
 *    write "45K" or spell amounts out in words, so dropping on a failed match
 *    would discard correct values more often than it caught invented ones. The
 *    user is told which fields could not be confirmed.
 *
 * The salary is checked against the amount the document *stated*, never against
 * the monthly figure this app derived from it.
 */
export function verifyAgainstSourceText(
  guarded: GuardedExtraction,
  sourceText: string,
): GuardedExtraction {
  const haystack = normalizeForMatch(sourceText);
  const numericHaystack = joinDigitGroups(haystack);
  const warnings = [...guarded.warnings];
  const unverified: (keyof ExtractedOfferFields)[] = [];

  const evidence = guarded.evidence.filter((entry) =>
    haystack.includes(normalizeForMatch(entry.quote)),
  );
  if (evidence.length !== guarded.evidence.length) {
    warnings.push(
      "Some supporting quotes did not appear in the uploaded document, so they were removed.",
    );
  }

  for (const [field, value] of Object.entries(guarded.fields) as [
    keyof ExtractedOfferFields,
    string | number | null,
  ][]) {
    if (value === null) continue;

    const located =
      field === "monthlySalary"
        ? containsNumber(numericHaystack, guarded.salaryConversion?.statedAmount ?? Number(value))
        : typeof value === "number"
          ? containsNumber(numericHaystack, value)
          : haystack.includes(normalizeForMatch(value));

    if (!located) unverified.push(field);
  }

  if (unverified.length > 0) {
    warnings.push(
      "Some values could not be found word-for-word in the document. They are marked below — confirm them before calculating.",
    );
  }

  return { ...guarded, evidence, warnings, unverifiedFields: unverified };
}

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Collapses "45,000" and "45 000" into "45000" so a figure matches how it is written. */
function joinDigitGroups(value: string): string {
  return value.replace(/(\d)[,\s](?=\d{3}(?:\D|$))/g, "$1");
}

function containsNumber(haystack: string, value: number): boolean {
  const candidates = new Set<string>([String(value), String(Math.round(value))]);
  if (Number.isInteger(value)) candidates.add(`${value}.00`);
  return [...candidates].some((candidate) => haystack.includes(candidate));
}

function optionalText(value: string | null | undefined, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const sanitized = sanitizeExtractedText(value, maxLength);
  return sanitized.length > 0 ? sanitized : null;
}

function resolveSalary(raw: RawOfferExtraction, warnings: string[]): SalaryConversion | null {
  const amount = raw.salaryAmount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;

  const currency = optionalText(raw.salaryCurrency, 16)?.toLowerCase();
  if (currency && !PESO_TOKENS.includes(currency)) {
    warnings.push(
      `The document states the pay in ${currency.toUpperCase()}. Commute Lens works in pesos and does not convert currencies, so enter the monthly peso amount yourself.`,
    );
    return null;
  }

  const period: SalaryPeriod = raw.salaryPeriod ?? "unknown";
  if (period === "unknown") {
    warnings.push(
      "The document did not clearly state whether that pay figure is monthly or annual, so the salary field was left blank.",
    );
    return null;
  }

  const monthlyAmount = round(amount * MONTHLY_FACTOR[period], 2);
  if (monthlyAmount < MIN_MONTHLY_SALARY || monthlyAmount > MAX_MONTHLY_SALARY) {
    warnings.push(
      "The pay figure read from the document is outside a plausible monthly range, so it was left blank rather than guessed.",
    );
    return null;
  }

  if (period !== "monthly") {
    warnings.push(
      `The document states ${period.replace("-", " ")} pay. Commute Lens converted it to a monthly figure — check it before calculating.`,
    );
  }

  return { statedAmount: amount, statedPeriod: period, monthlyAmount };
}

function resolveWorkingHours(value: number | null | undefined, warnings: string[]): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value <= 0 || value > 24) {
    warnings.push("The daily working hours read from the document were not usable.");
    return null;
  }
  return round(value, 2);
}

interface ResolvedSchedule {
  workArrangement: WorkArrangement | null;
  onsiteDaysPerWeek: number | null;
  workingDaysPerWeek: number | null;
}

function resolveSchedule(raw: RawOfferExtraction, warnings: string[]): ResolvedSchedule {
  const arrangement: WorkArrangement | null =
    raw.workArrangement && raw.workArrangement !== "unknown" ? raw.workArrangement : null;
  const onsiteDays = dayCount(raw.onsiteDaysPerWeek, 0);
  const workingDays = dayCount(raw.workingDaysPerWeek, 1);

  if (onsiteDays !== null && workingDays !== null && onsiteDays > workingDays) {
    warnings.push(
      "The office-day and working-day counts in the document contradict each other, so both were left for you to set.",
    );
    return { workArrangement: arrangement, onsiteDaysPerWeek: null, workingDaysPerWeek: null };
  }

  // A stated arrangement and a stated day count that disagree cannot be
  // reconciled without inventing intent, so neither is kept.
  if (arrangement === "remote" && onsiteDays !== null && onsiteDays > 0) {
    warnings.push(
      "The document calls the role remote but also lists office days, so the arrangement was left for you to choose.",
    );
    return { workArrangement: null, onsiteDaysPerWeek: null, workingDaysPerWeek: workingDays };
  }
  if (arrangement === "onsite" && onsiteDays === 0) {
    warnings.push(
      "The document calls the role onsite but lists zero office days, so the arrangement was left for you to choose.",
    );
    return { workArrangement: null, onsiteDaysPerWeek: null, workingDaysPerWeek: workingDays };
  }

  return {
    workArrangement: arrangement,
    onsiteDaysPerWeek: onsiteDays,
    workingDaysPerWeek: workingDays,
  };
}

function dayCount(value: number | null | undefined, minimum: number): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value >= minimum && value <= 7 ? value : null;
}

function guardEvidence(entries: RawOfferExtraction["evidence"]): OfferExtractionEvidence[] {
  if (!Array.isArray(entries)) return [];
  const seen = new Set<string>();
  const guarded: OfferExtractionEvidence[] = [];

  for (const entry of entries) {
    const field = EXTRACTABLE_FIELDS.find((candidate) => candidate === entry.field);
    if (!field || seen.has(field)) continue;
    const quote = sanitizeExtractedText(entry.quote, MAX_QUOTE_LENGTH);
    if (quote.length === 0) continue;
    seen.add(field);
    guarded.push({ field, quote });
    if (guarded.length >= MAX_EVIDENCE_ENTRIES) break;
  }

  return guarded;
}

export function hasAnyExtractedField(fields: ExtractedOfferFields): boolean {
  return Object.values(fields).some((value) => value !== null);
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
