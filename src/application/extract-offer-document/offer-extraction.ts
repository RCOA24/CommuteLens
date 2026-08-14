import { z } from "zod";
import type { WorkArrangement } from "@/domain/models";

/**
 * Offer-document extraction port.
 *
 * The contract is narrow on purpose. A provider may only *transcribe* what a
 * document says; it may not compute, convert, or infer. Salary period conversion,
 * plausibility bounds, and cross-field consistency all happen in this layer's
 * guardrails, so a model can never hand the analyzer a number it derived itself.
 *
 * Everything this produces is a *draft* for the user to confirm. Nothing here
 * reaches `analyzeJobOfferSchema` without passing through the offer form first.
 */

export type SalaryPeriod =
  "monthly" | "annual" | "semi-monthly" | "bi-weekly" | "weekly" | "unknown";

/**
 * The shape requested from the model, parsed defensively.
 *
 * Every field carries its own `.catch()`. Without that, zod fails the whole object
 * on a single bad field, so one capitalized enum or one salary returned as
 * `"45,000"` would discard an otherwise complete reading of the document.
 *
 * Field-level tolerance here, strict judgement in the guardrails. Reading through
 * a formatting quirk is not the same as accepting a value: the digits still belong
 * to the model, and the plausibility bounds and source verification still apply.
 */
const flexibleNumber = z.preprocess((value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return value ?? null;
  const cleaned = value.replace(/[^\d.-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}, z.number().nullable());

/** Maps the many ways a pay period gets written onto the one set we handle. */
const salaryPeriodField = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value ?? "unknown";
    const text = value.toLowerCase().trim();
    if (/semi.?month|twice a month|15th and 30th/.test(text)) return "semi-monthly";
    if (/bi.?week|fortnight|every two weeks|every other week/.test(text)) return "bi-weekly";
    if (/ann|year|per annum/.test(text)) return "annual";
    if (/month/.test(text)) return "monthly";
    if (/week/.test(text)) return "weekly";
    return "unknown";
  },
  z.enum(["monthly", "annual", "semi-monthly", "bi-weekly", "weekly", "unknown"]),
);

const workArrangementField = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value ?? "unknown";
    const text = value.toLowerCase().trim();
    if (/hybrid|mixed/.test(text)) return "hybrid";
    if (/remote|work from home|wfh|telecommut/.test(text)) return "remote";
    if (/on.?site|in.?office|wfo|on.?premise|office.?based/.test(text)) return "onsite";
    return "unknown";
  },
  z.enum(["onsite", "hybrid", "remote", "unknown"]),
);

export const rawOfferExtractionSchema = z.object({
  title: z.string().nullish().catch(null),
  company: z.string().nullish().catch(null),
  salaryAmount: flexibleNumber.catch(null),
  salaryPeriod: salaryPeriodField.catch("unknown"),
  salaryCurrency: z.string().nullish().catch(null),
  workArrangement: workArrangementField.catch("unknown"),
  onsiteDaysPerWeek: flexibleNumber.catch(null),
  workingDaysPerWeek: flexibleNumber.catch(null),
  workingHoursPerDay: flexibleNumber.catch(null),
  officeAddress: z.string().nullish().catch(null),
  evidence: z
    .array(z.object({ field: z.string(), quote: z.string() }))
    .nullish()
    .catch(null),
});

export type RawOfferExtraction = z.infer<typeof rawOfferExtractionSchema>;

/** Fields the offer form can be prefilled from, after all guardrails. */
export interface ExtractedOfferFields {
  title: string | null;
  company: string | null;
  monthlySalary: number | null;
  workArrangement: WorkArrangement | null;
  onsiteDaysPerWeek: number | null;
  workingDaysPerWeek: number | null;
  workingHoursPerDay: number | null;
  /** A free-text address to geocode. Never a coordinate — the model has none. */
  officeAddressQuery: string | null;
}

export interface OfferExtractionEvidence {
  field: keyof ExtractedOfferFields;
  quote: string;
}

export type OfferExtractionDegradedReason =
  | "not-configured"
  | "timeout"
  | "upstream"
  | "malformed"
  | "unauthorized"
  | "unreadable-document"
  | "nothing-extracted";

/** A deterministic record of any period conversion we performed ourselves. */
export interface SalaryConversion {
  statedAmount: number;
  statedPeriod: SalaryPeriod;
  monthlyAmount: number;
}

/** How the text the field reader saw was obtained. Shown to the user. */
export type OfferDocumentTextSource =
  /** Characters read straight out of the file. */
  | "text-layer"
  /** Recognized from a scan or photo by the OCR provider. */
  | "ocr"
  /** The file itself was handed to the field reader; no local text to check against. */
  | "document-upload";

export interface OfferDocumentExtraction {
  fields: ExtractedOfferFields;
  evidence: OfferExtractionEvidence[];
  /** Plain-language notes about anything dropped or converted. Always shown. */
  warnings: string[];
  salaryConversion: SalaryConversion | null;
  source: "ai-document" | "unavailable";
  degradedReason?: OfferExtractionDegradedReason;
  textSource: OfferDocumentTextSource;
  /**
   * Which stage was running when this failed, and how the text stage resolved.
   *
   * Two providers sit behind one button. Without this, a failure is only ever
   * "something upstream broke", which is not a diagnosis anyone can act on.
   */
  diagnostics: {
    textStage: "skipped-not-configured" | "unsupported-format" | "text-layer" | "ocr" | "failed";
    failedStage: "text-extraction" | "field-reading" | "none";
    elapsedMs: number;
  };
  /**
   * Fields that survived the guardrails but could not be located in the source
   * text. Kept, because a letter may write "45K" for 45,000, but flagged so the
   * user checks them first.
   */
  unverifiedFields: (keyof ExtractedOfferFields)[];
  /** True only when the source text was available to check values against. */
  verifiedAgainstSource: boolean;
  /** Reminds every caller that a human must confirm these values. */
  requiresReview: true;
}

export interface OfferDocumentFile {
  filename: string;
  contentType: string;
  bytes: Uint8Array;
}

export class OfferExtractionProviderError extends Error {
  constructor(
    message: string,
    readonly reason: Exclude<OfferExtractionDegradedReason, "nothing-extracted">,
  ) {
    super(message);
    this.name = "OfferExtractionProviderError";
  }
}

export interface OfferDocumentExtractionProvider {
  get isConfigured(): boolean;
  /** Reads fields from the file itself, when no local text is available. */
  extract(file: OfferDocumentFile, signal?: AbortSignal): Promise<RawOfferExtraction>;
  /**
   * Reads fields from already-extracted text. Preferred, because the caller
   * retains the source and can verify the result against it.
   */
  extractFromText(text: string, signal?: AbortSignal): Promise<RawOfferExtraction>;
}
