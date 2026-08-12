"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { analyzeJobOfferSchema } from "@/application/analyze-job-offer/schema";
import type { AnalyzeJobOfferResult } from "@/application/analyze-job-offer/use-case";
import { AnalyzeIcon, PillButton, PrinterIcon, ResetIcon } from "@/components/ui/pill-button";
import { LocationSearch } from "@/components/location/location-search";
import { JobRealityReceipt } from "@/components/receipt/job-reality-receipt";
import { JobOfferFields, type JobOfferFieldValues } from "@/components/job-offer/job-offer-fields";
import { DEMO_OFFICES, PRIMARY_DEMO_SCENARIO } from "@/data/demo";
import type { JobRealityAnalysis, Location } from "@/domain/models";

/**
 * [ASSUMPTION] The form seeds the rehearsed CUTC scenario so the demo opens on a
 * corridor the curated dataset covers. Not every origin/office pair is routable —
 * that is a property of the dataset owned by Member 3 (CL-006), so unsupported
 * pairs stay selectable and surface the provider's own message rather than being
 * hidden behind a hard-coded coverage map here.
 */
const SEED = PRIMARY_DEMO_SCENARIO;

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

interface JobOfferAnalyzerProps {
  children: ReactNode;
}

/**
 * Collects a job offer and renders the resulting Commute Reality Receipt.
 *
 * The endpoint is the only thing that analyses anything. This component never
 * derives a business metric — it collects input, posts it, and displays what
 * comes back, because the deterministic engines are the single source of truth
 * for every number the user sees.
 */
export function JobOfferAnalyzer({ children }: JobOfferAnalyzerProps) {
  const formId = useId();
  const [origin, setOrigin] = useState<Location | null>(SEED.origin);
  const [offerFields, setOfferFields] = useState<JobOfferFieldValues>({
    officeKey: "bgc",
    title: SEED.jobOffer.title,
    company: SEED.jobOffer.company,
    monthlySalary: String(SEED.jobOffer.monthlySalary),
    workArrangement: SEED.jobOffer.workArrangement,
    onsiteDaysPerWeek: String(SEED.jobOffer.onsiteDaysPerWeek),
    workingHoursPerDay: String(SEED.jobOffer.workingHoursPerDay),
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  // Stamped together so the receipt's issue date can never drift from its analysis.
  const [receipt, setReceipt] = useState<{
    analysis: JobRealityAnalysis;
    issuedAt: Date;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      origin: origin ?? SEED.origin,
      jobOffer: {
        id: `job-${crypto.randomUUID()}`,
        title: offerFields.title,
        company: offerFields.company,
        monthlySalary: toNumber(offerFields.monthlySalary),
        officeLocation: DEMO_OFFICES[offerFields.officeKey],
        workArrangement: offerFields.workArrangement,
        onsiteDaysPerWeek: toNumber(offerFields.onsiteDaysPerWeek),
        workingHoursPerDay: toNumber(offerFields.workingHoursPerDay),
      },
    };

    // Validated with the same schema the server uses, so the user sees field-level
    // errors without a round trip. This is a convenience, not a trust boundary —
    // the route re-validates every request independently.
    const parsed = analyzeJobOfferSchema.safeParse(payload);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        errors[path] ??= messageFor(path, issue);
      }
      setFieldErrors(errors);
      setRequestError(null);
      setReceipt(null);
      return;
    }

    setFieldErrors({});
    setRequestError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/commute/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = (await response.json()) as AnalyzeJobOfferResult;

      if (result.success) {
        setReceipt({ analysis: result.data, issuedAt: new Date() });
      } else {
        setReceipt(null);
        setRequestError(result.error.message);
      }
    } catch {
      setReceipt(null);
      setRequestError("Could not reach the analyzer. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <section className="max-w-[760px] print:hidden">
        {children}
        <form onSubmit={handleSubmit} className="mt-8 grid gap-6" noValidate>
          <p className="text-[0.85rem] leading-[1.5] text-muted">
            Fill in the job offer details and where you would commute from. We handle the math.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <LocationSearch
              value={origin}
              onChange={setOrigin}
              label="WHERE YOU LIVE"
              placeholder="Search a location..."
              error={fieldErrors["origin"] ?? null}
              idPrefix={`${formId}-origin`}
            />
            <JobOfferFields
              idPrefix={formId}
              values={offerFields}
              onChange={setOfferFields}
              errors={fieldErrors}
            />
          </div>
          <div className="flex justify-end">
            <PillButton
              type="submit"
              variant="primary"
              size="lg"
              icon={<AnalyzeIcon />}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Analyzing…" : "Show the real cost"}
            </PillButton>
          </div>
        </form>
      </section>

      <div aria-live="polite">
        {receipt ? (
          <div>
            <JobRealityReceipt analysis={receipt.analysis} issuedAt={receipt.issuedAt} />
            <div className="mx-auto mt-5 flex max-w-[380px] flex-wrap gap-3 wide:mx-0 wide:max-w-none print:hidden">
              <PillButton variant="secondary" icon={<PrinterIcon />} onClick={() => window.print()}>
                Print Your Receipt
              </PillButton>
              <PillButton variant="ghost" icon={<ResetIcon />} onClick={() => setReceipt(null)}>
                New Analysis
              </PillButton>
            </div>
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
              <p>{isSubmitting ? "Analyzing this offer…" : "Your receipt will appear here."}</p>
            )}
          </section>
        )}
      </div>
    </>
  );
}
