import {
  DocumentTextExtractionError,
  type DocumentText,
  type DocumentTextExtractor,
} from "./document-text";
import {
  applyExtractionGuardrails,
  hasAnyExtractedField,
  verifyAgainstSourceText,
} from "./guardrails";
import {
  OfferExtractionProviderError,
  type OfferDocumentExtraction,
  type OfferDocumentExtractionProvider,
  type OfferDocumentFile,
  type OfferDocumentTextSource,
} from "./offer-extraction";

/**
 * Offer-document extraction use case.
 *
 * Two stages, deliberately separate. First the document becomes text — locally
 * for formats that carry their own, by OCR for PDFs and photos. Then a field
 * reader turns that text into a draft.
 *
 * Keeping them apart buys the thing that matters: when the text is available
 * here, every extracted value and quote is checked against it. Handing the raw
 * file to the reader still works and is the fallback, but nothing about that path
 * can be verified, and the result says so.
 *
 * Every outcome carries diagnostics naming the stage that failed, because with two
 * providers in the chain an undifferentiated error is not actionable.
 *
 * Contract, mirroring `ExplainAnalysisUseCase`: this never throws. Extraction is
 * an enhancement over typing the form by hand, so every failure returns an empty
 * draft plus the reason it is empty.
 */

type TextStage = OfferDocumentExtraction["diagnostics"]["textStage"];

const EMPTY_EXTRACTION: OfferDocumentExtraction["fields"] = {
  title: null,
  company: null,
  monthlySalary: null,
  workArrangement: null,
  onsiteDaysPerWeek: null,
  workingDaysPerWeek: null,
  workingHoursPerDay: null,
  officeAddressQuery: null,
};

export class ExtractOfferDocumentUseCase {
  constructor(
    private readonly provider: OfferDocumentExtractionProvider | null,
    private readonly textExtractor: DocumentTextExtractor | null = null,
  ) {}

  async execute(file: OfferDocumentFile, signal?: AbortSignal): Promise<OfferDocumentExtraction> {
    const startedAt = Date.now();
    const elapsed = () => Date.now() - startedAt;

    if (!this.provider?.isConfigured) {
      return unavailable("not-configured", "document-upload", {
        textStage: "skipped-not-configured",
        failedStage: "field-reading",
        elapsedMs: elapsed(),
      });
    }

    let documentText: DocumentText | null = null;
    let textStage: TextStage = "skipped-not-configured";

    if (this.textExtractor?.isConfigured) {
      try {
        documentText = (await this.textExtractor.extractText(file, signal)) ?? null;
        textStage = documentText?.source ?? "unsupported-format";
      } catch (error) {
        textStage = "failed";
        const reason = error instanceof DocumentTextExtractionError ? error.reason : "upstream";
        const textElapsed = elapsed();
        log(`text stage failed (${reason}) after ${textElapsed}ms`);

        // A document that is genuinely unreadable, or a budget that is already
        // spent, must not be retried down a slower path.
        if (reason === "unreadable-document" || reason === "empty") {
          return unavailable("unreadable-document", "document-upload", {
            textStage,
            failedStage: "text-extraction",
            elapsedMs: textElapsed,
          });
        }
        if (reason === "timeout") {
          return unavailable("timeout", "document-upload", {
            textStage,
            failedStage: "text-extraction",
            elapsedMs: textElapsed,
          });
        }
        // Anything else falls through to letting the field reader take the file.
      }
    }

    const textSource: OfferDocumentTextSource = documentText?.source ?? "document-upload";
    log(
      `text stage=${textStage} source=${textSource} chars=${documentText?.text.length ?? 0} in ${elapsed()}ms`,
    );

    let raw;
    try {
      raw = documentText
        ? await this.provider.extractFromText(documentText.text, signal)
        : await this.provider.extract(file, signal);
    } catch (error) {
      const reason =
        error instanceof OfferExtractionProviderError ? error.reason : ("upstream" as const);
      log(`field reader failed (${reason}) after ${elapsed()}ms`);
      return unavailable(reason, textSource, {
        textStage,
        failedStage: "field-reading",
        elapsedMs: elapsed(),
      });
    }

    const guarded = documentText
      ? verifyAgainstSourceText(applyExtractionGuardrails(raw), documentText.text)
      : applyExtractionGuardrails(raw);

    log(`complete in ${elapsed()}ms`);

    const common = {
      ...guarded,
      textSource,
      verifiedAgainstSource: documentText !== null,
      diagnostics: { textStage, failedStage: "none" as const, elapsedMs: elapsed() },
      requiresReview: true as const,
    };

    if (!hasAnyExtractedField(guarded.fields)) {
      return { ...common, source: "unavailable", degradedReason: "nothing-extracted" };
    }
    return { ...common, source: "ai-document" };
  }
}

function unavailable(
  reason: NonNullable<OfferDocumentExtraction["degradedReason"]>,
  textSource: OfferDocumentTextSource,
  diagnostics: OfferDocumentExtraction["diagnostics"],
): OfferDocumentExtraction {
  return {
    fields: { ...EMPTY_EXTRACTION },
    evidence: [],
    warnings: [],
    salaryConversion: null,
    source: "unavailable",
    degradedReason: reason,
    textSource,
    unverifiedFields: [],
    verifiedAgainstSource: false,
    diagnostics,
    requiresReview: true,
  };
}

/** Stage timings only. Document contents are never logged. */
function log(message: string): void {
  console.info(`[offer-extract] ${message}`);
}
