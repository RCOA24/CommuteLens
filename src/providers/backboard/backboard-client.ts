import { z } from "zod";

/**
 * Backboard.io HTTP adapter.
 *
 * Implemented with `fetch` for the same reason as the OpenAI adapters: no vendor
 * SDK in the request path, and one place where upstream shapes are validated
 * before they reach the application layer.
 *
 * The key is read server-side only. It is never returned, logged, or echoed, and
 * upstream error text is deliberately discarded rather than forwarded, so a
 * provider message can never surface in the UI.
 *
 * Endpoint reference: https://docs.backboard.io (base URL https://app.backboard.io/api)
 */

const DEFAULT_BASE_URL = "https://app.backboard.io/api";
const DEFAULT_LLM_PROVIDER = "openai";
const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 25_000;

export type BackboardFailureReason =
  | "not-configured"
  | "unauthorized"
  /** The resource is not there — which for a delete is the desired end state. */
  | "not-found"
  | "timeout"
  | "upstream"
  | "malformed";

export class BackboardError extends Error {
  constructor(
    message: string,
    readonly reason: BackboardFailureReason,
  ) {
    super(message);
    this.name = "BackboardError";
  }
}

/** Backboard's document pipeline states. Only `indexed` is usable for retrieval. */
export type BackboardDocumentStatus = "pending" | "processing" | "indexed" | "error";

export interface BackboardMemory {
  id: string;
  content: string;
  createdAt: string | null;
}

export interface BackboardMessageResult {
  content: string;
  threadId: string;
  assistantId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface SendMessageInput {
  content: string;
  threadId?: string;
  assistantId?: string;
  systemPrompt?: string;
  /** Ask the model for a JSON object. Used for every structured extraction. */
  jsonOutput?: boolean;
  /** Memory Lite mode. Defaults to "off" — writes must be deliberate. */
  memory?: "Auto" | "Readonly" | "off";
  webSearch?: "Auto" | "off";
  model?: string;
  llmProvider?: string;
}

const assistantSchema = z.object({ assistant_id: z.string().min(1) });
const threadSchema = z.object({ thread_id: z.string().min(1) });

const documentSchema = z.object({
  document_id: z.string().min(1),
  filename: z.string().optional(),
  status: z.enum(["pending", "processing", "indexed", "error"]),
  status_message: z.string().nullable().optional(),
});

/**
 * Parsed defensively, and for a specific reason.
 *
 * With `json_output` enabled, `content` can arrive already decoded as an object
 * rather than as a JSON string. Typing it as a string made a *successful*
 * structured response look like a malformed one, and because zod fails an object
 * on a single bad field, the usage counters could do the same. Only `thread_id`
 * is genuinely required; everything else tolerates its own absence or surprise.
 */
const messageContentSchema = z
  .union([z.string(), z.record(z.string(), z.unknown()), z.array(z.unknown())])
  .nullish();

const messageSchema = z.object({
  thread_id: z.union([z.string(), z.number()]).transform(String),
  assistant_id: z.union([z.string(), z.number()]).nullish().catch(null),
  content: messageContentSchema.catch(null),
  input_tokens: z.coerce.number().nullish().catch(null),
  output_tokens: z.coerce.number().nullish().catch(null),
});

/** Normalizes a decoded-object content back into the JSON text callers expect. */
function readMessageContent(content: z.infer<typeof messageContentSchema>): string {
  if (content === null || content === undefined) return "";
  return typeof content === "string" ? content.trim() : JSON.stringify(content);
}

/**
 * Tolerant on purpose. The documented list payload uses `content`, while some
 * memory payloads use `memory`/`memory_id`; accepting both keeps a harmless
 * naming difference from breaking the feature.
 */
const memoryListSchema = z.object({
  memories: z
    .array(
      z.object({
        id: z.union([z.string(), z.number()]).nullable().optional(),
        memory_id: z.union([z.string(), z.number()]).nullable().optional(),
        content: z.string().nullable().optional(),
        memory: z.string().nullable().optional(),
        created_at: z.string().nullable().optional(),
      }),
    )
    .default([]),
});

const addMemorySchema = z.object({
  id: z.union([z.string(), z.number()]).nullable().optional(),
  memory_id: z.union([z.string(), z.number()]).nullable().optional(),
});

export interface BackboardClientOptions {
  apiKey?: string;
  baseUrl?: string;
  llmProvider?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class BackboardClient {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;
  readonly llmProvider: string;
  readonly model: string;
  readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: BackboardClientOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.BACKBOARD_API_KEY;
    this.baseUrl = trimTrailingSlash(
      options.baseUrl ?? process.env.BACKBOARD_BASE_URL?.trim() ?? DEFAULT_BASE_URL,
    );
    this.llmProvider =
      options.llmProvider ?? envOrUndefined("BACKBOARD_LLM_PROVIDER") ?? DEFAULT_LLM_PROVIDER;
    this.model = options.model ?? envOrUndefined("BACKBOARD_MODEL") ?? DEFAULT_MODEL;
    this.timeoutMs = options.timeoutMs ?? readTimeout() ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  get isConfigured(): boolean {
    return typeof this.apiKey === "string" && this.apiKey.trim().length > 0;
  }

  async createAssistant(input: { name: string; systemPrompt?: string }): Promise<string> {
    const parsed = await this.request(
      "/assistants",
      {
        method: "POST",
        json: {
          name: input.name,
          ...(input.systemPrompt ? { system_prompt: input.systemPrompt } : {}),
        },
      },
      assistantSchema,
    );
    return parsed.assistant_id;
  }

  async deleteAssistant(assistantId: string): Promise<void> {
    await this.request(
      `/assistants/${encodeURIComponent(assistantId)}`,
      { method: "DELETE" },
      null,
    );
  }

  async createThread(assistantId: string): Promise<string> {
    const parsed = await this.request(
      `/assistants/${encodeURIComponent(assistantId)}/threads`,
      { method: "POST", json: {} },
      threadSchema,
    );
    return parsed.thread_id;
  }

  /**
   * Deletes a thread and everything attached to it. Used to discard an uploaded
   * offer letter as soon as its fields have been read.
   */
  async deleteThread(threadId: string, signal?: AbortSignal): Promise<void> {
    await this.request(
      `/threads/${encodeURIComponent(threadId)}`,
      { method: "DELETE", signal },
      null,
    );
  }

  async uploadThreadDocument(
    threadId: string,
    file: { filename: string; contentType: string; bytes: Uint8Array },
    signal?: AbortSignal,
  ): Promise<{ documentId: string; status: BackboardDocumentStatus }> {
    const form = new FormData();
    // A fresh ArrayBuffer copy keeps Blob happy regardless of how the caller
    // sliced the incoming upload.
    const body = new Uint8Array(file.bytes);
    form.append("file", new Blob([body], { type: file.contentType }), file.filename);

    const parsed = await this.request(
      `/threads/${encodeURIComponent(threadId)}/documents`,
      { method: "POST", form, signal },
      documentSchema,
    );
    return { documentId: parsed.document_id, status: parsed.status };
  }

  async getDocumentStatus(
    documentId: string,
    signal?: AbortSignal,
  ): Promise<{ status: BackboardDocumentStatus }> {
    const parsed = await this.request(
      `/documents/${encodeURIComponent(documentId)}/status`,
      { method: "GET", signal },
      documentSchema.pick({ status: true }),
    );
    return { status: parsed.status };
  }

  async sendMessage(
    input: SendMessageInput,
    signal?: AbortSignal,
  ): Promise<BackboardMessageResult> {
    const parsed = await this.request(
      "/threads/messages",
      {
        method: "POST",
        signal,
        json: {
          content: input.content,
          ...(input.threadId ? { thread_id: input.threadId } : {}),
          ...(input.assistantId ? { assistant_id: input.assistantId } : {}),
          ...(input.systemPrompt ? { system_prompt: input.systemPrompt } : {}),
          llm_provider: input.llmProvider ?? this.llmProvider,
          model_name: input.model ?? this.model,
          stream: false,
          json_output: input.jsonOutput ?? false,
          memory: input.memory ?? "off",
          web_search: input.webSearch ?? "off",
        },
      },
      messageSchema,
    );

    const content = readMessageContent(parsed.content);
    if (content.length === 0) {
      throw new BackboardError("Backboard returned no message content.", "malformed");
    }
    return {
      content,
      threadId: parsed.thread_id,
      assistantId: parsed.assistant_id === null ? null : String(parsed.assistant_id),
      inputTokens: parsed.input_tokens ?? null,
      outputTokens: parsed.output_tokens ?? null,
    };
  }

  async listMemories(assistantId: string, signal?: AbortSignal): Promise<BackboardMemory[]> {
    const parsed = await this.request(
      `/assistants/${encodeURIComponent(assistantId)}/memories`,
      { method: "GET", signal },
      memoryListSchema,
    );
    return parsed.memories.flatMap((entry) => {
      const id = entry.id ?? entry.memory_id;
      const content = entry.content ?? entry.memory;
      if (id === null || id === undefined || !content) return [];
      return [{ id: String(id), content, createdAt: entry.created_at ?? null }];
    });
  }

  async addMemory(
    assistantId: string,
    content: string,
    metadata?: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<string | null> {
    const parsed = await this.request(
      `/assistants/${encodeURIComponent(assistantId)}/memories`,
      {
        method: "POST",
        signal,
        json: { content, ...(metadata ? { metadata } : {}) },
      },
      addMemorySchema,
    );
    const id = parsed.memory_id ?? parsed.id;
    return id === null || id === undefined ? null : String(id);
  }

  async deleteMemory(assistantId: string, memoryId: string, signal?: AbortSignal): Promise<void> {
    await this.request(
      `/assistants/${encodeURIComponent(assistantId)}/memories/${encodeURIComponent(memoryId)}`,
      { method: "DELETE", signal },
      null,
    );
  }

  private async request<TSchema extends z.ZodType | null>(
    path: string,
    init: {
      method: "GET" | "POST" | "DELETE";
      json?: unknown;
      form?: FormData;
      signal?: AbortSignal;
      timeoutMs?: number;
    },
    schema: TSchema,
  ): Promise<TSchema extends z.ZodType ? z.infer<TSchema> : void> {
    if (!this.isConfigured) {
      throw new BackboardError("Backboard is not configured.", "not-configured");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? this.timeoutMs);
    init.signal?.addEventListener("abort", () => controller.abort(), { once: true });

    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: init.method,
        signal: controller.signal,
        headers: {
          // Backboard authenticates with X-API-Key, not a bearer token.
          "X-API-Key": this.apiKey as string,
          ...(init.json === undefined ? {} : { "Content-Type": "application/json" }),
        },
        // FormData must set its own multipart boundary, so it is passed through
        // untouched and no Content-Type header is added above.
        body: init.form ?? (init.json === undefined ? undefined : JSON.stringify(init.json)),
      });

      if (response.status === 401 || response.status === 403) {
        throw new BackboardError("Backboard rejected the API key.", "unauthorized");
      }
      /*
       * Distinguished from a general failure because "it is not there" is often
       * the outcome the caller wanted. Deleting something already deleted is a
       * success, not an error, and only a separate reason lets callers say so.
       */
      if (response.status === 404) {
        throw new BackboardError("Backboard has no such resource.", "not-found");
      }
      if (!response.ok) {
        await logUpstreamFailure("Backboard", path, response);
        throw new BackboardError("Backboard rejected the request.", "upstream");
      }
      if (schema === null) {
        return undefined as TSchema extends z.ZodType ? z.infer<TSchema> : void;
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new BackboardError("Backboard returned a non-JSON response.", "malformed");
      }

      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        // Keys and the first issue only. Never the payload, which may hold
        // document text.
        console.warn(
          `[backboard] ${path} response did not match: ${parsed.error.issues[0]?.path.join(".")} ${
            parsed.error.issues[0]?.message
          }; keys=${describeKeys(payload)}`,
        );
        throw new BackboardError("Backboard returned an unsupported response.", "malformed");
      }
      return parsed.data as TSchema extends z.ZodType ? z.infer<TSchema> : void;
    } catch (error) {
      if (error instanceof BackboardError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new BackboardError("Backboard timed out.", "timeout");
      }
      throw new BackboardError("Backboard is unreachable.", "upstream");
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Server-side diagnostics for a rejected request.
 *
 * User-facing messages stay generic, but throwing away the provider's own
 * explanation makes every failure a guessing game. The body is truncated, and the
 * request is identified by path only — the key is never part of either.
 */
export async function logUpstreamFailure(
  provider: string,
  path: string,
  response: Response,
): Promise<void> {
  let detail = "";
  try {
    detail = (await response.text()).slice(0, 500);
  } catch {
    detail = "<unreadable body>";
  }
  console.warn(`[${provider.toLowerCase()}] ${path} -> ${response.status}: ${detail}`);
}

export function describeKeys(payload: unknown): string {
  if (payload === null || typeof payload !== "object") return typeof payload;
  return Object.keys(payload as Record<string, unknown>)
    .slice(0, 12)
    .join(",");
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function envOrUndefined(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : undefined;
}

function readTimeout(): number | undefined {
  const raw = envOrUndefined("BACKBOARD_TIMEOUT_MS");
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
