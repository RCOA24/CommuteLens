import {
  DocumentTextExtractionError,
  type DocumentText,
  type DocumentTextExtractor,
} from "@/application/extract-offer-document/document-text";
import type { OfferDocumentFile } from "@/application/extract-offer-document/offer-extraction";
import { LocalDocumentTextExtractor } from "./local-document-text.extractor";
import { PaddleOcrDocumentTextExtractor } from "./paddleocr-document-text.extractor";

export { LocalDocumentTextExtractor } from "./local-document-text.extractor";
export { PaddleOcrDocumentTextExtractor } from "./paddleocr-document-text.extractor";

let cachedExtractor: DocumentTextExtractor | null | undefined;

/**
 * Tries each extractor in order, skipping any that does not own the format.
 *
 * A `null` return means "not mine, keep going". A throw means the extractor that
 * owns this format genuinely failed, and that is not something to paper over by
 * trying a less suitable reader — it is reported so the caller can fall back to
 * sending the raw file to the field reader instead.
 */
function composeExtractors(extractors: readonly DocumentTextExtractor[]): DocumentTextExtractor {
  return {
    get isConfigured() {
      return extractors.some((extractor) => extractor.isConfigured);
    },
    async extractText(file: OfferDocumentFile, signal?: AbortSignal): Promise<DocumentText | null> {
      for (const extractor of extractors) {
        if (!extractor.isConfigured) continue;
        const result = await extractor.extractText(file, signal);
        if (result) return result;
      }
      return null;
    },
  };
}

/**
 * Order: local text formats first because they are exact and free, then OCR for
 * PDFs and photos. Returns null when nothing is available, which makes the field
 * reader fall back to uploading the document itself.
 */
export function getDocumentTextExtractor(): DocumentTextExtractor | null {
  if (cachedExtractor !== undefined) return cachedExtractor;
  if (process.env.NODE_ENV === "test") return (cachedExtractor = null);

  const extractors: DocumentTextExtractor[] = [new LocalDocumentTextExtractor()];
  const ocr = new PaddleOcrDocumentTextExtractor();
  if (ocr.isConfigured) extractors.push(ocr);

  /*
   * Stated once per process, on purpose. Whether OCR is active decides whether a
   * PDF gets read at all, and an unset key looks identical to a slow provider from
   * the outside. Environment changes need a dev-server restart to take effect.
   */
  console.info(
    `[document-text] extractors ready: local text${ocr.isConfigured ? " + PaddleOCR" : " only (PADDLEOCR_API_KEY not loaded — PDFs and photos will skip OCR)"}`,
  );

  return (cachedExtractor = composeExtractors(extractors));
}

export function resetDocumentTextExtractor(): void {
  cachedExtractor = undefined;
}

export { DocumentTextExtractionError };
