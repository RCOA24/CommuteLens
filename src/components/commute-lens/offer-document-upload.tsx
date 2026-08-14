"use client";

import { FileText, Info, Loader2, Upload } from "lucide-react";
import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { OfferDocumentExtractionResult } from "@/app/api/offer-document/extract/route";
import type {
  OfferDocumentExtraction,
  OfferExtractionDegradedReason,
} from "@/application/extract-offer-document/offer-extraction";
import type { Location } from "@/domain/models";
import { Eyebrow } from "@/components/ui/typography";
import { ActionButton } from "@/components/ui/action-button";

/**
 * Optional shortcut into the offer form: upload the offer letter and let the
 * document reader fill in what it can.
 *
 * Two rules are visible in the UI, not just in the code. The reader only
 * transcribes, so every filled field is presented as something to check rather
 * than something settled. And a failure is stated plainly, because the form
 * underneath always works without this.
 */

const ACCEPT = ".pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,.webp";

/**
 * Something to read while a scan is processed.
 *
 * Reading a photo can take most of a minute, and a frozen spinner reads as
 * broken. These lines are about the *document*, so they double as an explanation
 * of what is happening rather than filler. They stay gentle about employers: the
 * user may be about to accept this job.
 *
 * Rotated visually only. Screen readers get one stable message instead, because
 * re-announcing a joke every few seconds would be hostile.
 */
const READING_LINES = [
  "Opening your offer letter…",
  "Finding the salary, not the corporate poetry.",
  "Reading the fine print so you don’t have to.",
  "Checking whether “competitive package” came with a number.",
  "Looking for the office address and the schedule.",
  "Almost there — good documents take a moment.",
] as const;

const LINE_INTERVAL_MS = 2_600;

/**
 * What the person holding the letter is told.
 *
 * Calm, jargon-free, and always ending in the same place: the form below still
 * works. This shortcut failing is a minor inconvenience, not an error the user
 * caused or has to solve, so it is not written like one. Stage names and timings
 * belong in the collapsed technical panel and the server log.
 */
const DEGRADED_MESSAGE: Record<OfferExtractionDegradedReason, string> = {
  "not-configured": "Reading offer letters isn’t switched on yet — just fill in the details below.",
  unauthorized:
    "The document reader isn’t available right now. Fill in the details below and nothing else changes.",
  timeout:
    "That document is taking longer to read than we can wait. A smaller or clearer file often works, or you can fill in the details below.",
  upstream:
    "We couldn’t reach the document reader just now. Fill in the details below and nothing else changes.",
  malformed:
    "We couldn’t read that document automatically. Fill in the details below and nothing else changes.",
  "unreadable-document":
    "We couldn’t make out the text in that file. A clearer photo, or the original PDF instead of a scan, usually works.",
  "nothing-extracted":
    "We read the document but couldn’t find any offer details in it, so nothing was changed. Fill in the details below instead.",
};

/**
 * Names the stage that produced text before the failure.
 *
 * Two providers sit behind this control, so "it did not work" is not an
 * actionable message for the person holding the document — nor for whoever has to
 * debug it.
 */
/** Kept out of the main message, but reachable when someone wants to report a bug. */
function technicalDetail(extraction: OfferDocumentExtraction): string {
  const { textStage, failedStage, elapsedMs } = extraction.diagnostics;
  return [
    `stage: ${failedStage}`,
    `text: ${textStage}`,
    `reason: ${extraction.degradedReason ?? "unknown"}`,
    `elapsed: ${(elapsedMs / 1000).toFixed(1)}s`,
  ].join(" · ");
}

export function OfferDocumentUpload({
  onApply,
}: {
  onApply: (extraction: OfferDocumentExtraction, officeCandidates: Location[]) => void;
}) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "reading">("idle");
  const [filename, setFilename] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ message: string; detail: string | null } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lineIndex, setLineIndex] = useState(0);
  const reduceMotion = usePrefersReducedMotion();

  /*
   * Advance the reading lines only while a read is in flight. Reduced-motion users
   * keep the first line, which is the informative one.
   */
  useEffect(() => {
    if (state !== "reading" || reduceMotion) return;
    const timer = setInterval(
      () => setLineIndex((current) => (current + 1) % READING_LINES.length),
      LINE_INTERVAL_MS,
    );
    return () => clearInterval(timer);
  }, [state, reduceMotion]);

  async function read(file: File) {
    setState("reading");
    setProblem(null);
    setFilename(file.name);

    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/offer-document/extract", { method: "POST", body });
      const result = (await response.json()) as OfferDocumentExtractionResult;

      if (!result.success) {
        setProblem({ message: result.error.message, detail: null });
        return;
      }
      const { extraction, officeCandidates } = result.data;
      if (extraction.source === "unavailable") {
        setProblem({
          message:
            DEGRADED_MESSAGE[extraction.degradedReason ?? "upstream"] ?? DEGRADED_MESSAGE.upstream,
          detail: technicalDetail(extraction),
        });
        return;
      }
      onApply(extraction, officeCandidates);
    } catch {
      setProblem({
        message: "That upload didn’t go through. Check your connection and try again.",
        detail: null,
      });
    } finally {
      setState("idle");
      // Allows re-selecting the same file after a correction.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void read(file);
  }

  const isReading = state === "reading";

  return (
    <section className="app-panel mx-auto max-w-5xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Eyebrow tone="flame">Optional shortcut</Eyebrow>
          <h2 className="mt-2 font-headline text-lg font-black tracking-[-0.02em]">
            Start from the offer letter
          </h2>
          <p id={hintId} className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted">
            Upload the offer as a PDF, Word file, or photo and we will fill in what it states. It
            reads the document only — every field still needs your check, and the salary is never
            recalculated for you.
          </p>
        </div>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`mt-4 flex flex-wrap items-center gap-3 rounded-[1rem] border border-dashed p-4 transition-colors ${
          isDragging ? "border-flame bg-mint/30" : "border-ink/25"
        }`}
      >
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-paper"
        >
          {isReading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : filename ? (
            <FileText className="size-4" />
          ) : (
            <Upload className="size-4" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <label htmlFor={inputId} className="text-xs font-black tracking-[0.08em] uppercase">
            Offer document
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={ACCEPT}
            disabled={isReading}
            aria-describedby={hintId}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void read(file);
            }}
            className="mt-1 block w-full text-sm file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-full file:border-0 file:bg-mint/60 file:px-4 file:text-xs file:font-black file:tracking-[0.08em] file:uppercase disabled:opacity-60"
          />
          <p className="mt-1 text-[0.7rem] text-muted">
            PDF, DOC, DOCX, TXT, MD, or an image. Up to 2 MB. Drag a file here if you prefer.
          </p>
        </div>

        {isReading && (
          <ActionButton variant="quiet" disabled>
            Reading…
          </ActionButton>
        )}
      </div>

      <div role="status" aria-live="polite" className="mt-3">
        {isReading ? (
          <>
            {/* The one announced message. Stable on purpose. */}
            <p className="sr-only">
              Reading {filename ?? "your document"}. This can take up to a minute.
            </p>
            <div aria-hidden="true" className="min-h-[2.75rem]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={lineIndex}
                  initial={reduceMotion ? undefined : { opacity: 0, y: 6 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                  className="text-sm leading-relaxed font-bold"
                >
                  {READING_LINES[lineIndex]}
                </motion.p>
              </AnimatePresence>
              <p className="mt-0.5 text-[0.7rem] leading-relaxed text-muted">
                A scan or photo can take up to a minute. The form below stays available.
              </p>
            </div>
          </>
        ) : problem ? (
          <div className="rounded-[1rem] bg-mint/35 p-3">
            <p className="flex items-start gap-2 text-sm leading-relaxed">
              <Info className="mt-0.5 size-3.5 shrink-0 text-flame" aria-hidden="true" />
              <span>{problem.message}</span>
            </p>
            {problem.detail && (
              <details className="mt-2">
                <summary className="cursor-pointer text-[0.7rem] font-bold tracking-[0.08em] text-muted uppercase">
                  Technical details
                </summary>
                <p className="numeric mt-1 text-[0.7rem] break-words text-muted">
                  {problem.detail}
                </p>
              </details>
            )}
          </div>
        ) : (
          <p className="sr-only">No document read yet.</p>
        )}
      </div>
    </section>
  );
}
