import { z } from "zod";
import {
  DocumentTextExtractionError,
  hasUsableText,
  normalizeDocumentText,
  type DocumentText,
  type DocumentTextExtractor,
} from "@/application/extract-offer-document/document-text";
import type { OfferDocumentFile } from "@/application/extract-offer-document/offer-extraction";
import { logUpstreamFailure } from "@/providers/backboard/backboard-client";

/**
 * PaddleOCR AI Studio adapter.
 *
 * The service is asynchronous: submit a job, poll it, then download a JSONL
 * result. That shape is fine on a serverless host only if it is bounded, so the
 * whole pipeline shares one deadline and the poll interval is far tighter than
 * the 5 s in the vendor sample. Running out of budget is reported as a timeout
 * the caller can degrade on, never as a hang.
 *
 * Only markdown-producing models are supported. `PP-OCRv6` job results expose
 * recognized images rather than a text field, so it cannot serve this port.
 *
 * Reference: https://paddleocr.aistudio-app.com/api/v2/ocr/jobs
 */

const DEFAULT_JOB_URL = "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs";
/**
 * PP-StructureV3 is the default because it is the faster of the two
 * markdown-producing models: a layout pipeline rather than a vision-language
 * model doing a full pass per page. An offer letter is an upright page of prose
 * and maybe a pay table, which is squarely what the pipeline is for.
 *
 * Set `PADDLEOCR_MODEL=PaddleOCR-VL-1.6` when quality on bad phone photos matters
 * more than the seconds — it reads creased, dim, and handwritten pages better.
 */
const DEFAULT_MODEL = "PP-StructureV3";
const DEFAULT_TIMEOUT_MS = 40_000;
const POLL_INTERVAL_MS = 900;
const SUBMIT_TIMEOUT_MS = 20_000;
const POLL_REQUEST_TIMEOUT_MS = 10_000;

/** Formats PaddleOCR reads from a file. Text formats never reach this adapter. */
const SUPPORTED_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff"]);

/**
 * Layout analysis is left off deliberately.
 *
 * Orientation classification, unwarping, and chart recognition each add cost and
 * latency. An offer letter is an upright page of prose and at most a pay table,
 * so none of them earn their keep here.
 */
const OPTIONAL_PAYLOAD = {
  useDocOrientationClassify: false,
  useDocUnwarping: false,
  useChartRecognition: false,
} as const;

const submitSchema = z.object({
  data: z.object({ jobId: z.union([z.string(), z.number()]) }),
});

const jobStateSchema = z.object({
  data: z.object({
    state: z.enum(["pending", "running", "done", "failed"]),
    errorMsg: z.string().nullish(),
    extractProgress: z
      .object({
        totalPages: z.number().nullish(),
        extractedPages: z.number().nullish(),
      })
      .nullish(),
    // Validated as https at the point of use rather than by format here.
    resultUrl: z.object({ jsonUrl: z.string().min(1) }).nullish(),
  }),
});

/**
 * One JSONL line. Both markdown-producing models nest their text under
 * `layoutParsingResults[].markdown.text`; everything else in the payload is
 * rendered imagery this adapter has no use for.
 */
const resultLineSchema = z.object({
  result: z.object({
    layoutParsingResults: z
      .array(z.object({ markdown: z.object({ text: z.string() }).nullish() }))
      .nullish(),
  }),
});

export interface PaddleOcrDocumentTextExtractorOptions {
  apiKey?: string;
  jobUrl?: string;
  model?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  fetchImpl?: typeof fetch;
}

export class PaddleOcrDocumentTextExtractor implements DocumentTextExtractor {
  private readonly apiKey: string | undefined;
  private readonly jobUrl: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly pollIntervalMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: PaddleOcrDocumentTextExtractorOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.PADDLEOCR_API_KEY;
    this.jobUrl = options.jobUrl ?? envOrUndefined("PADDLEOCR_JOB_URL") ?? DEFAULT_JOB_URL;
    this.model = options.model ?? envOrUndefined("PADDLEOCR_MODEL") ?? DEFAULT_MODEL;
    this.timeoutMs = options.timeoutMs ?? readTimeout() ?? DEFAULT_TIMEOUT_MS;
    this.pollIntervalMs = options.pollIntervalMs ?? POLL_INTERVAL_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  get isConfigured(): boolean {
    return typeof this.apiKey === "string" && this.apiKey.trim().length > 0;
  }

  async extractText(file: OfferDocumentFile, signal?: AbortSignal): Promise<DocumentText | null> {
    const extension = file.filename.split(".").pop()?.toLowerCase() ?? "";
    if (!SUPPORTED_EXTENSIONS.has(extension)) return null;
    if (!this.isConfigured) {
      throw new DocumentTextExtractionError("PaddleOCR is not configured.", "not-configured");
    }

    const deadline = Date.now() + this.timeoutMs;
    const jobId = await this.submit(file, signal, deadline);
    const jsonUrl = await this.awaitResult(jobId, signal, deadline);
    const { text, pages } = await this.downloadResult(jsonUrl, signal, deadline);

    const normalized = normalizeDocumentText(text);
    if (!hasUsableText(normalized)) {
      throw new DocumentTextExtractionError(
        "PaddleOCR found no readable text in that document.",
        "empty",
      );
    }
    return { text: normalized, source: "ocr", pages };
  }

  private async submit(
    file: OfferDocumentFile,
    signal: AbortSignal | undefined,
    deadline: number,
  ): Promise<string> {
    const form = new FormData();
    form.append("model", this.model);
    // The vendor API expects this as a JSON *string* in multipart mode.
    form.append("optionalPayload", JSON.stringify(OPTIONAL_PAYLOAD));
    form.append(
      "file",
      new Blob([new Uint8Array(file.bytes)], { type: file.contentType }),
      file.filename,
    );

    const response = await this.request(this.jobUrl, {
      method: "POST",
      body: form,
      signal,
      timeoutMs: Math.min(SUBMIT_TIMEOUT_MS, remaining(deadline)),
    });

    const parsed = submitSchema.safeParse(await readJson(response));
    if (!parsed.success) {
      throw new DocumentTextExtractionError("PaddleOCR returned no job id.", "malformed");
    }
    // safeParse wraps the payload, and the payload itself nests under `data`.
    const jobId = String(parsed.data.data.jobId);
    console.info(`[paddleocr] submitted job ${jobId} (${this.model})`);
    return jobId;
  }

  private async awaitResult(
    jobId: string,
    signal: AbortSignal | undefined,
    deadline: number,
  ): Promise<string> {
    let polls = 0;
    while (true) {
      const response = await this.request(`${this.jobUrl}/${encodeURIComponent(jobId)}`, {
        method: "GET",
        signal,
        timeoutMs: Math.min(POLL_REQUEST_TIMEOUT_MS, remaining(deadline)),
      });

      const payload = await readJson(response);
      const parsed = jobStateSchema.safeParse(payload);
      if (!parsed.success) {
        console.warn(
          `[paddleocr] job ${jobId} state did not match: ${parsed.error.issues[0]?.message}`,
        );
        throw new DocumentTextExtractionError(
          "PaddleOCR returned an unsupported job state.",
          "malformed",
        );
      }
      const { state, resultUrl, errorMsg } = parsed.data.data;
      console.info(`[paddleocr] job ${jobId} state=${state}`);
      if (state === "failed" && errorMsg) {
        console.warn(`[paddleocr] job ${jobId} failed: ${errorMsg.slice(0, 300)}`);
      }

      if (state === "done") {
        if (!resultUrl?.jsonUrl) {
          throw new DocumentTextExtractionError(
            "PaddleOCR finished without a result URL.",
            "malformed",
          );
        }
        return resultUrl.jsonUrl;
      }
      if (state === "failed") {
        // The vendor message is not forwarded: it is diagnostic, not user-facing.
        throw new DocumentTextExtractionError(
          "PaddleOCR could not read that document.",
          "unreadable-document",
        );
      }

      /*
       * Reserve enough budget to sleep, poll once more, and still download the
       * result. Backing off gently keeps a long job from spending its whole
       * allowance on poll requests while staying responsive on a short one.
       */
      const reserve = this.pollIntervalMs + POLL_REQUEST_TIMEOUT_MS;
      if (remaining(deadline) <= reserve) {
        throw new DocumentTextExtractionError("PaddleOCR timed out.", "timeout");
      }
      await sleep(Math.min(this.pollIntervalMs * ++polls, 2_500), signal);
    }
  }

  private async downloadResult(
    jsonUrl: string,
    signal: AbortSignal | undefined,
    deadline: number,
  ): Promise<{ text: string; pages: number }> {
    // The URL arrives from an authenticated response, but it is still a
    // provider-controlled address, so plaintext transport is refused outright.
    if (!jsonUrl.startsWith("https://")) {
      throw new DocumentTextExtractionError(
        "PaddleOCR returned an insecure result URL.",
        "malformed",
      );
    }

    const response = await this.request(jsonUrl, {
      method: "GET",
      signal,
      timeoutMs: remaining(deadline),
      // The result store is pre-signed and rejects the API key header.
      anonymous: true,
    });

    const body = await response.text();
    const pageTexts: string[] = [];

    for (const line of body.split("\n")) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      let payload: unknown;
      try {
        payload = JSON.parse(trimmed);
      } catch {
        continue;
      }
      const parsed = resultLineSchema.safeParse(payload);
      if (!parsed.success) continue;
      for (const page of parsed.data.result.layoutParsingResults ?? []) {
        const text = page.markdown?.text;
        if (text && text.trim().length > 0) pageTexts.push(text);
      }
    }

    if (pageTexts.length === 0) {
      throw new DocumentTextExtractionError(
        "PaddleOCR returned no markdown text. Check that the configured model produces markdown.",
        "malformed",
      );
    }
    return { text: pageTexts.join("\n\n"), pages: pageTexts.length };
  }

  private async request(
    url: string,
    init: {
      method: "GET" | "POST";
      body?: FormData;
      signal?: AbortSignal;
      timeoutMs: number;
      anonymous?: boolean;
    },
  ): Promise<Response> {
    if (init.timeoutMs <= 0) {
      throw new DocumentTextExtractionError("PaddleOCR timed out.", "timeout");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), init.timeoutMs);
    init.signal?.addEventListener("abort", () => controller.abort(), { once: true });

    try {
      const response = await this.fetchImpl(url, {
        method: init.method,
        signal: controller.signal,
        // Lowercase "bearer" matches the documented scheme.
        headers: init.anonymous ? {} : { Authorization: `bearer ${this.apiKey as string}` },
        body: init.body,
      });

      if (response.status === 401 || response.status === 403) {
        await logUpstreamFailure("PaddleOCR", redactUrl(url), response);
        throw new DocumentTextExtractionError("PaddleOCR rejected the API key.", "upstream");
      }
      if (!response.ok) {
        await logUpstreamFailure("PaddleOCR", redactUrl(url), response);
        throw new DocumentTextExtractionError("PaddleOCR rejected the request.", "upstream");
      }
      return response;
    } catch (error) {
      if (error instanceof DocumentTextExtractionError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new DocumentTextExtractionError("PaddleOCR timed out.", "timeout");
      }
      throw new DocumentTextExtractionError("PaddleOCR is unreachable.", "upstream");
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new DocumentTextExtractionError("PaddleOCR returned a non-JSON response.", "malformed");
  }
}

/** Result URLs are pre-signed, so the query string is stripped before logging. */
function redactUrl(url: string): string {
  const queryStart = url.indexOf("?");
  return queryStart === -1 ? url : `${url.slice(0, queryStart)}?<signed>`;
}

function remaining(deadline: number): number {
  return deadline - Date.now();
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DocumentTextExtractionError("PaddleOCR timed out.", "timeout"));
      },
      { once: true },
    );
  });
}

function envOrUndefined(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function readTimeout(): number | undefined {
  const raw = envOrUndefined("PADDLEOCR_TIMEOUT_MS");
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
