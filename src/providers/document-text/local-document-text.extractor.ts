import { strFromU8, unzipSync } from "fflate";
import {
  DocumentTextExtractionError,
  hasUsableText,
  normalizeDocumentText,
  type DocumentText,
  type DocumentTextExtractor,
} from "@/application/extract-offer-document/document-text";
import type { OfferDocumentFile } from "@/application/extract-offer-document/offer-extraction";

/**
 * Local text extraction, for formats that already carry their text.
 *
 * A `.txt` or `.docx` offer needs no OCR and no network hop: the characters are
 * right there, and reading them is exact rather than recognized. That is both
 * faster and more trustworthy, so these formats never reach a paid service.
 *
 * PDFs are deliberately not handled here. Extracting a PDF text layer would need
 * a new dependency, and the OCR provider already reads PDFs — including scanned
 * ones, which a text-layer reader cannot. Worth revisiting only if OCR quota
 * becomes the binding constraint on the common emailed-PDF case.
 */

const DOCX_ENTRY = "word/document.xml";
/** Guards against a zip bomb: an offer letter's XML is tens of kilobytes. */
const MAX_DOCX_XML_BYTES = 8 * 1024 * 1024;

const XML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
};

export class LocalDocumentTextExtractor implements DocumentTextExtractor {
  get isConfigured(): boolean {
    return true;
  }

  async extractText(file: OfferDocumentFile): Promise<DocumentText | null> {
    const extension = file.filename.split(".").pop()?.toLowerCase() ?? "";

    const raw =
      extension === "txt" || extension === "md" || extension === "markdown"
        ? decodeUtf8(file.bytes)
        : extension === "docx"
          ? readDocx(file.bytes)
          : null;

    // Not a format this extractor owns. The chain moves on.
    if (raw === null) return null;

    const text = normalizeDocumentText(raw);
    if (!hasUsableText(text)) {
      throw new DocumentTextExtractionError("That document contains no readable text.", "empty");
    }
    return { text, source: "text-layer", pages: 1 };
  }
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    // Fatal decoding: a mislabelled binary should fail rather than become mojibake
    // that the field reader would then dutifully misread.
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new DocumentTextExtractionError("That file is not readable text.", "unreadable-document");
  }
}

/**
 * Reads a .docx by pulling the single document part out of the zip.
 *
 * Paragraph and tab boundaries are converted before tags are stripped, because
 * without them a pay table collapses into one unreadable run of digits.
 */
function readDocx(bytes: Uint8Array): string {
  let extracted: Uint8Array | undefined;
  try {
    const files = unzipSync(bytes, {
      filter(file) {
        return (
          normalizeEntryName(file.name) === DOCX_ENTRY && file.originalSize <= MAX_DOCX_XML_BYTES
        );
      },
    });
    // The surviving key keeps its original casing, so it is matched the same way.
    const entry = Object.keys(files).find((name) => normalizeEntryName(name) === DOCX_ENTRY);
    extracted = entry ? files[entry] : undefined;
  } catch {
    throw new DocumentTextExtractionError(
      "That Word file could not be opened.",
      "unreadable-document",
    );
  }

  if (!extracted) {
    throw new DocumentTextExtractionError(
      "That Word file has no readable document part.",
      "unreadable-document",
    );
  }

  const xml = strFromU8(extracted);
  const withBreaks = xml
    .replace(/<w:tab\b[^>]*\/?>/g, " ")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<w:br\b[^>]*\/?>/g, "\n")
    // A table cell boundary is a column break, not a word boundary.
    .replace(/<\/w:tc>/g, " | ")
    .replace(/<\/w:tr>/g, "\n");

  return decodeXmlEntities(withBreaks.replace(/<[^>]+>/g, ""));
}

function normalizeEntryName(name: string): string {
  return name.replace(/\\/g, "/").toLowerCase();
}

function decodeXmlEntities(value: string): string {
  return value.replace(
    /&(?:amp|lt|gt|quot|apos|#39);/g,
    (entity) => XML_ENTITIES[entity] ?? entity,
  );
}
