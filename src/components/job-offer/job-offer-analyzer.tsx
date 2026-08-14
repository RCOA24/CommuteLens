"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { analyzeJobOfferSchema } from "@/application/analyze-job-offer/schema";
import type { AnalyzeJobOfferResult } from "@/application/analyze-job-offer/use-case";
import { compareJobOffersSchema } from "@/application/compare-job-offers/schema";
import type { CompareJobOffersResult } from "@/application/compare-job-offers/use-case";
import { JobComparison } from "@/components/comparison/job-comparison";
import {
  AnalyzeIcon,
  CompareIcon,
  PillButton,
  PrinterIcon,
  ResetIcon,
} from "@/components/ui/pill-button";
import { LocationSearch } from "@/components/location/location-search";
import { JobRealityReceipt } from "@/components/receipt/job-reality-receipt";
import { JobOfferFields, type JobOfferFieldValues } from "@/components/job-offer/job-offer-fields";
import { DEMO_OFFICES, DEMO_SCENARIOS, PRIMARY_DEMO_SCENARIO } from "@/data/demo";
import type { JobRealityAnalysis, JobRealityComparison, Location } from "@/domain/models";

/**
 * [ASSUMPTION] The form seeds the rehearsed CUTC scenario so the demo opens on a
 * corridor the curated dataset covers. Not every origin/office pair is routable —
 * that is a property of the dataset owned by Member 3 (CL-006), so unsupported
 * pairs stay selectable and surface the provider's own message rather than being
 * hidden behind a hard-coded coverage map here.
 */
const SEED = PRIMARY_DEMO_SCENARIO;

/**
 * [ASSUMPTION] Job B seeds from the scenario Member 3 authored for this exact
 * pairing (CL-016, "compare-b-alabang-bgc-onsite"). Falls back to the hero
 * scenario if that id is ever renamed, so the form still opens with valid input
 * rather than blank fields.
 */
const COMPARISON_SEED =
  DEMO_SCENARIOS.find((scenario) => scenario.id === "compare-b-alabang-bgc-onsite") ?? SEED;

/** Blank fields must fail validation rather than silently becoming zero. */
function toNumber(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

/**
 * Zod's own messages are written for developers. These replace them per field so
 * the form speaks to the person filling it in.
 */
const FIELD_MESSAGES: Record<string, string> = {
  "jobOffer.title": "Add a job title.",
  "jobOffer.company": "Add a company name.",
  "jobOffer.monthlySalary": "Enter a monthly salary greater than 0.",
  "jobOffer.onsiteDaysPerWeek": "Enter a whole number of onsite days, from 0 to 5.",
  "jobOffer.workingHoursPerDay": "Enter working hours per day, up to 24.",
};

function messageFor(path: string, issue: { code: string; message: string }): string {
  if (issue.code === "custom") return issue.message;
  return FIELD_MESSAGES[path] ?? "Check this value.";
}

/** Turns Zod issues into one message per field path, first issue winning. */
function collectIssues(issues: readonly { path: PropertyKey[]; code: string; message: string }[]) {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path.join(".");
    // Comparison paths are prefixed with the offer they belong to. Field messages
    // are written against the unprefixed path, so look them up without it.
    const unprefixed = path.replace(/^job[AB]\./, "");
    errors[path] ??= messageFor(unprefixed, issue);
  }
  return errors;
}

/**
 * Narrows a flat error map to one offer and strips its prefix, so JobOfferFields
 * can stay unaware of whether it is rendering Job A, Job B, or the only job.
 */
function scopeErrors(errors: Record<string, string>, prefix: string): Record<string, string> {
  const scoped: Record<string, string> = {};
  for (const [path, message] of Object.entries(errors)) {
    if (path.startsWith(`${prefix}.`)) scoped[path.slice(prefix.length + 1)] = message;
  }
  return scoped;
}

function seedFields(scenario: (typeof DEMO_SCENARIOS)[number]): JobOfferFieldValues {
  return {
    officeKey: "bgc",
    title: scenario.jobOffer.title,
    company: scenario.jobOffer.company,
    monthlySalary: String(scenario.jobOffer.monthlySalary),
    workArrangement: scenario.jobOffer.workArrangement,
    onsiteDaysPerWeek: String(scenario.jobOffer.onsiteDaysPerWeek),
    workingHoursPerDay: String(scenario.jobOffer.workingHoursPerDay),
  };
}

function buildOfferPayload(origin: Location, fields: JobOfferFieldValues) {
  return {
    origin,
    jobOffer: {
      id: `job-${crypto.randomUUID()}`,
      title: fields.title,
      company: fields.company,
      monthlySalary: toNumber(fields.monthlySalary),
      officeLocation: DEMO_OFFICES[fields.officeKey],
      workArrangement: fields.workArrangement,
      onsiteDaysPerWeek: toNumber(fields.onsiteDaysPerWeek),
      workingHoursPerDay: toNumber(fields.workingHoursPerDay),
    },
  };
}

type Mode = "single" | "compare";

/**
 * One offer analysed, or two compared — never both. Modelled as a union so a
 * stale receipt cannot linger on screen underneath a comparison.
 */
type Result =
  | { kind: "single"; analysis: JobRealityAnalysis; issuedAt: Date }
  | { kind: "compare"; comparison: JobRealityComparison };

interface JobOfferAnalyzerProps {
  children: ReactNode;
}

/**
 * Collects one or two job offers and renders the resulting Commute Reality
 * Receipt, or a side-by-side comparison.
 *
 * The endpoints are the only things that analyse anything. This component never
 * derives a business metric — it collects input, posts it, and displays what
 * comes back, because the deterministic engines are the single source of truth
 * for every number the user sees.
 */
export function JobOfferAnalyzer({ children }: JobOfferAnalyzerProps) {
  const formId = useId();
  const [mode, setMode] = useState<Mode>("single");

  /*
   * Each offer carries its own origin. The comparison endpoint takes a full
   * analyze payload per job, and the seeded pair Member 3 authored deliberately
   * starts from two different homes — comparing an offer you would relocate for
   * is a real question, so the UI does not narrow what the contract allows.
   */
  const [originA, setOriginA] = useState<Location | null>(SEED.origin);
  const [originB, setOriginB] = useState<Location | null>(COMPARISON_SEED.origin);
  const [fieldsA, setFieldsA] = useState<JobOfferFieldValues>(() => seedFields(SEED));
  const [fieldsB, setFieldsB] = useState<JobOfferFieldValues>(() => seedFields(COMPARISON_SEED));

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  // Stamped together so the receipt's issue date can never drift from its analysis.
  const [result, setResult] = useState<Result | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    // The previous result answered a different question. Clear it rather than
    // leaving a single receipt on screen while the form now asks for two offers.
    setResult(null);
    setFieldErrors({});
    setRequestError(null);
  }

  async function post<T>(endpoint: string, body: unknown): Promise<T | null> {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await response.json()) as T;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload =
      mode === "single"
        ? buildOfferPayload(originA ?? SEED.origin, fieldsA)
        : {
            jobA: buildOfferPayload(originA ?? SEED.origin, fieldsA),
            jobB: buildOfferPayload(originB ?? COMPARISON_SEED.origin, fieldsB),
          };

    // Validated with the same schema the server uses, so the user sees field-level
    // errors without a round trip. This is a convenience, not a trust boundary —
    // the route re-validates every request independently.
    const parsed =
      mode === "single"
        ? analyzeJobOfferSchema.safeParse(payload)
        : compareJobOffersSchema.safeParse(payload);

    if (!parsed.success) {
      setFieldErrors(collectIssues(parsed.error.issues));
      setRequestError(null);
      setResult(null);
      return;
    }

    setFieldErrors({});
    setRequestError(null);
    setIsSubmitting(true);

    try {
      if (mode === "single") {
        const response = await post<AnalyzeJobOfferResult>("/api/commute/analyze", parsed.data);
        if (response?.success) {
          setResult({ kind: "single", analysis: response.data, issuedAt: new Date() });
        } else {
          setResult(null);
          setRequestError(response?.error.message ?? "The analyzer returned an unexpected reply.");
        }
      } else {
        const response = await post<CompareJobOffersResult>("/api/commute/compare", parsed.data);
        if (response?.success) {
          setResult({ kind: "compare", comparison: response.data });
        } else {
          setResult(null);
          setRequestError(response?.error.message ?? "The analyzer returned an unexpected reply.");
        }
      }
    } catch {
      setResult(null);
      setRequestError("Could not reach the analyzer. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const isCompare = mode === "compare";

  return (
    <>
      <section className="max-w-[760px] print:hidden">
        {children}

        <div className="mt-8 flex gap-2" role="group" aria-label="Analysis mode">
          <ModeTab isActive={!isCompare} onClick={() => switchMode("single")}>
            One offer
          </ModeTab>
          <ModeTab isActive={isCompare} onClick={() => switchMode("compare")}>
            Compare two
          </ModeTab>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-6" noValidate>
          <p className="text-[0.85rem] leading-[1.5] text-muted">
            {isCompare
              ? "Fill in both offers and where you would commute from for each. We handle the math."
              : "Fill in the job offer details and where you would commute from. We handle the math."}
          </p>

          {isCompare ? (
            <div className="grid gap-8 sm:grid-cols-2">
              <OfferColumn
                heading="Job A"
                idPrefix={`${formId}-a`}
                origin={originA}
                onOriginChange={setOriginA}
                fields={fieldsA}
                onFieldsChange={setFieldsA}
                errors={scopeErrors(fieldErrors, "jobA")}
              />
              <OfferColumn
                heading="Job B"
                idPrefix={`${formId}-b`}
                origin={originB}
                onOriginChange={setOriginB}
                fields={fieldsB}
                onFieldsChange={setFieldsB}
                errors={scopeErrors(fieldErrors, "jobB")}
              />
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              <LocationSearch
                value={originA}
                onChange={setOriginA}
                label="WHERE YOU LIVE"
                placeholder="Search a location..."
                error={fieldErrors["origin"] ?? null}
                idPrefix={`${formId}-origin`}
              />
              <JobOfferFields
                idPrefix={formId}
                values={fieldsA}
                onChange={setFieldsA}
                errors={fieldErrors}
              />
            </div>
          )}

          <div className="flex justify-end">
            <PillButton
              type="submit"
              variant="primary"
              size="lg"
              icon={isCompare ? <CompareIcon /> : <AnalyzeIcon />}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Analyzing…"
                : isCompare
                  ? "Compare these offers"
                  : "Show the real cost"}
            </PillButton>
          </div>
        </form>
      </section>

      <div aria-live="polite">
        {result?.kind === "single" ? (
          <div>
            <JobRealityReceipt analysis={result.analysis} issuedAt={result.issuedAt} />
            <ResultActions onReset={() => setResult(null)} printLabel="Print Your Receipt" />
          </div>
        ) : result?.kind === "compare" ? (
          <div className="comparison-print">
            <JobComparison comparison={result.comparison} />
            <ResultActions onReset={() => setResult(null)} printLabel="Print Comparison" />
          </div>
        ) : (
          <section
            className="mx-auto w-full max-w-[440px] border border-dashed border-ink/40 p-8 text-muted wide:mx-0 wide:max-w-none print:hidden"
            aria-label="Receipt placeholder"
          >
            {requestError ? (
              <p role="alert" className="font-bold text-ink">
                {requestError}
              </p>
            ) : (
              <p>
                {isSubmitting
                  ? isCompare
                    ? "Comparing these offers…"
                    : "Analyzing this offer…"
                  : isCompare
                    ? "Your comparison will appear here."
                    : "Your receipt will appear here."}
              </p>
            )}
          </section>
        )}
      </div>
    </>
  );
}

function ModeTab({
  isActive,
  onClick,
  children,
}: {
  isActive: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={`rounded-full border px-4 py-1.5 text-[0.78rem] font-semibold transition-colors ${
        isActive
          ? "border-ink bg-ink text-paper"
          : "border-ink/20 text-muted hover:border-ink/50 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function OfferColumn({
  heading,
  idPrefix,
  origin,
  onOriginChange,
  fields,
  onFieldsChange,
  errors,
}: {
  heading: string;
  idPrefix: string;
  origin: Location | null;
  onOriginChange: (location: Location | null) => void;
  fields: JobOfferFieldValues;
  onFieldsChange: (next: JobOfferFieldValues) => void;
  errors: Record<string, string>;
}) {
  return (
    <fieldset className="grid gap-5">
      <legend className="mb-1 text-[0.7rem] font-bold tracking-[0.14em] text-ink uppercase">
        {heading}
      </legend>
      <LocationSearch
        value={origin}
        onChange={onOriginChange}
        label="WHERE YOU LIVE"
        placeholder="Search a location..."
        error={errors["origin"] ?? null}
        idPrefix={`${idPrefix}-origin`}
      />
      <JobOfferFields
        idPrefix={idPrefix}
        values={fields}
        onChange={onFieldsChange}
        errors={errors}
      />
    </fieldset>
  );
}

function ResultActions({ onReset, printLabel }: { onReset: () => void; printLabel: string }) {
  return (
    <div className="mx-auto mt-5 flex max-w-[380px] flex-wrap gap-3 wide:mx-0 wide:max-w-none print:hidden">
      <PillButton variant="secondary" icon={<PrinterIcon />} onClick={() => window.print()}>
        {printLabel}
      </PillButton>
      <PillButton variant="ghost" icon={<ResetIcon />} onClick={onReset}>
        New Analysis
      </PillButton>
    </div>
  );
}
