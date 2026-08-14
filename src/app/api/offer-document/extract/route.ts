import { ExtractOfferDocumentUseCase } from "@/application/extract-offer-document/use-case";
import type { OfferDocumentExtraction } from "@/application/extract-offer-document/offer-extraction";
import type { Location } from "@/domain/models";
import { getGeocodingProvider } from "@/providers/geocoding";
import { getOfferDocumentExtractionProvider } from "@/providers/backboard";
import { getDocumentTextExtractor } from "@/providers/document-text";
import { checkRateLimit } from "@/shared/security/rate-limit";
import type { ApiResult } from "@/shared/types/api";

export const runtime = "nodejs";
/** Document indexing plus one read. Kept above the client's own timeout. */
export const maxDuration = 60;

/**
 * Offer-letter extraction endpoint.
 *
 * This produces a *draft* for the offer form. It deliberately does not call the
 * analyzer: a document-derived salary must pass under the user's eyes and through
 * `analyzeJobOfferSchema` before it becomes a receipt.
 *
 * The uploaded file is streamed to the extraction provider and never written to
 * disk, logged, or retained by this app.
 */

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_OFFICE_CANDIDATES = 3;

/**
 * The authoritative budget for the whole pipeline: OCR plus the field read.
 *
 * Each provider has its own timeout, but those can sum past the platform's
 * function limit. This deadline is what actually bounds the request, so it sits
 * just inside `maxDuration` and the individual provider timeouts become upper
 * bounds on their own step rather than a total anyone has to add up by hand.
 */
const REQUEST_BUDGET_MS = 55_000;

const ALLOWED_EXTENSIONS: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
  txt: "text/plain",
  md: "text/markdown",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  bmp: "image/bmp",
  tif: "image/tiff",
  tiff: "image/tiff",
};

export type OfferDocumentExtractionResult = ApiResult<
  {
    extraction: OfferDocumentExtraction;
    /** Geocoded matches for the extracted address. The user still picks one. */
    officeCandidates: Location[];
  },
  "INVALID_INPUT"
>;

function invalidInput(message: string): Response {
  return Response.json(
    {
      success: false,
      error: { code: "INVALID_INPUT", message },
    } satisfies OfferDocumentExtractionResult,
    { status: 400 },
  );
}

export async function POST(request: Request): Promise<Response> {
  const limited = checkRateLimit(request, "offer-document", 5);
  if (limited) return limited;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return invalidInput("Upload the document as multipart form data.");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return invalidInput("Attach the offer document in a field named 'file'.");
  }
  if (file.size === 0) {
    return invalidInput("That file is empty.");
  }
  if (file.size > MAX_FILE_BYTES) {
    return invalidInput("That file is larger than 2 MB. Upload the offer letter on its own.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const allowedContentType = ALLOWED_EXTENSIONS[extension];
  if (!allowedContentType) {
    return invalidInput("Upload a PDF, Word file, text file, or a photo of the offer letter.");
  }

  const budget = AbortSignal.timeout(REQUEST_BUDGET_MS);
  const extraction = await new ExtractOfferDocumentUseCase(
    getOfferDocumentExtractionProvider(),
    getDocumentTextExtractor(),
  ).execute(
    {
      filename: sanitizeFilename(file.name, extension),
      // The declared browser type is not trusted; the vetted extension decides.
      contentType: allowedContentType,
      bytes: new Uint8Array(await file.arrayBuffer()),
    },
    budget,
  );

  return Response.json({
    success: true,
    data: {
      extraction,
      officeCandidates: await geocodeOffice(extraction.fields.officeAddressQuery),
    },
  } satisfies OfferDocumentExtractionResult);
}

/** Keeps a provider-facing filename free of paths and control characters. */
function sanitizeFilename(name: string, extension: string): string {
  const base = name
    .replace(/[\p{Cc}\p{Cf}]/gu, "")
    .split(/[\\/]/)
    .pop()
    ?.replace(/[^\w.\- ]/g, "_")
    .slice(0, 80);
  return base && base.length > 0 ? base : `offer.${extension}`;
}

/**
 * A best-effort convenience. The office coordinate is required by the analyzer
 * and cannot come from a document, so the extracted address is offered as search
 * candidates for the user to confirm — never auto-selected.
 */
async function geocodeOffice(query: string | null): Promise<Location[]> {
  if (!query) return [];
  try {
    const matches = await getGeocodingProvider().search(query);
    return matches.slice(0, MAX_OFFICE_CANDIDATES);
  } catch {
    return [];
  }
}
