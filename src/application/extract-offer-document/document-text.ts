import type { OfferDocumentFile } from "./offer-extraction";

/**
 * Document-to-text port.
 *
 * Separating "get the text" from "read the fields" is what makes extraction
 * checkable. Once the source text exists in this process, the guardrails can
 * verify that every quoted phrase and every extracted figure actually appears in
 * the document, instead of taking a model's word for it.
 *
 * `source` is provenance, and it is surfaced to the user for the same reason the
 * route layer labels Live, Estimated, and Archival: how a value was obtained
 * changes how much it should be trusted.
 */

export type DocumentTextSource =
  /** Read directly out of the file, byte for byte. Nothing was interpreted. */
  | "text-layer"
  /** Recognized from a scan or photo. Accurate, but a reading of an image. */
  | "ocr";

export interface DocumentText {
  text: string;
  source: DocumentTextSource;
  /** Pages the provider reported reading. 1 for a plain text file. */
  pages: number;
}

export type DocumentTextFailureReason =
  | "not-configured"
  | "unsupported-format"
  | "timeout"
  | "upstream"
  | "malformed"
  | "unreadable-document"
  | "empty";

export class DocumentTextExtractionError extends Error {
  constructor(
    message: string,
    readonly reason: DocumentTextFailureReason,
  ) {
    super(message);
    this.name = "DocumentTextExtractionError";
  }
}

export interface DocumentTextExtractor {
  get isConfigured(): boolean;
  /**
   * Returns null when this extractor does not handle the format, so a composed
   * chain can try the next one. It throws only on a genuine failure.
   */
  extractText(file: OfferDocumentFile, signal?: AbortSignal): Promise<DocumentText | null>;
}

/**
 * The upper bound on text handed to the field reader.
 *
 * Offer letters are short. This cap is a prompt-injection and cost control: with
 * inline text the document sits directly in the message body rather than behind
 * retrieval, so its size has to be bounded before it is ever sent.
 */
export const MAX_DOCUMENT_TEXT_LENGTH = 20_000;

/** Enough characters to be a real document rather than an empty text layer. */
export const MIN_USABLE_TEXT_LENGTH = 40;

/**
 * Normalizes provider text without discarding the layout that carries meaning.
 *
 * Line structure is kept, because a salary sitting in a markdown table row is
 * only legible as a row. Control characters and runaway blank lines are removed,
 * and the result is truncated on a line boundary so a table is never cut mid-row.
 */
export function normalizeDocumentText(raw: string): string {
  const cleaned = raw
    .replace(/\r\n?/g, "\n")
    // Control characters other than the newline we just normalized.
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[^\S\n]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleaned.length <= MAX_DOCUMENT_TEXT_LENGTH) return cleaned;
  const truncated = cleaned.slice(0, MAX_DOCUMENT_TEXT_LENGTH);
  const lastBreak = truncated.lastIndexOf("\n");
  return lastBreak > MAX_DOCUMENT_TEXT_LENGTH / 2 ? truncated.slice(0, lastBreak) : truncated;
}

export function hasUsableText(text: string): boolean {
  return text.trim().length >= MIN_USABLE_TEXT_LENGTH;
}
