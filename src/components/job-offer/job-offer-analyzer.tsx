"use client";

import { useId, useState, type FormEvent, type ReactNode } from "react";
import { analyzeJobOfferSchema } from "@/application/analyze-job-offer/schema";
import type { AnalyzeJobOfferResult } from "@/application/analyze-job-offer/use-case";
import { JobRealityReceipt } from "@/components/receipt/job-reality-receipt";
import {
  DEMO_OFFICES,
  DEMO_ORIGINS,
  PRIMARY_DEMO_SCENARIO,
  type DemoOfficeKey,
  type DemoOriginKey,
} from "@/data/demo";
import type { JobRealityAnalysis, Location, WorkArrangement } from "@/domain/models";

const ORIGIN_ENTRIES = Object.entries(DEMO_ORIGINS) as [DemoOriginKey, Location][];
const OFFICE_ENTRIES = Object.entries(DEMO_OFFICES) as [DemoOfficeKey, Location][];

const WORK_ARRANGEMENTS: readonly { value: WorkArrangement; label: string }[] = [
  { value: "onsite", label: "Fully onsite" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Fully remote" },
];

/**
 * [ASSUMPTION] The form seeds from the rehearsed CUTC scenario so the demo opens
 * on a corridor the curated dataset covers. Not every origin/office pair is
 * routable — that is a dataset property owned by Member 3 (CL-006), so the
 * unsupported pairs stay selectable and surface the provider's own message
 * rather than being hidden behind a hard-coded coverage map here.
 */
const SEED = PRIMARY_DEMO_SCENARIO;

/** Blank fields must fail validation rather than silently becoming zero. */
function toNumber(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

/**
 * Zod's default messages describe the type system ("expected number, received
 * NaN"), which is not something to show a person filling in a form. Issues the
 * schema authors wrote by hand are already user-facing, so those pass through
 * untouched and only the generated ones get replaced.
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

const fieldClass =
  "min-h-11 w-full border border-ink/25 bg-paper px-3 py-2 text-base focus:border-accent focus:outline-2 focus:outline-offset-1 focus:outline-accent disabled:opacity-50";
const labelClass = "block text-[0.78rem] font-extrabold tracking-[0.12em] text-muted uppercase";
const errorClass = "mt-1 block text-[0.8rem] font-bold text-accent";

interface JobOfferAnalyzerProps {
  /** Server-rendered hero markup, slotted above the form. */
  children: ReactNode;
}

/**
 * Collects a job offer, sends it to the analyze endpoint, and renders the
 * returned receipt.
 *
 * The endpoint is the only thing that analyses anything: this component posts
 * input and displays whatever comes back. It deliberately does not import the
 * use case or a transit provider, so the browser can never run the calculation
 * or reach a provider directly.
 */
export function JobOfferAnalyzer({ children }: JobOfferAnalyzerProps) {
  const formId = useId();
  const [originKey, setOriginKey] = useState<DemoOriginKey>("cubao");
  const [officeKey, setOfficeKey] = useState<DemoOfficeKey>("bgc");
  const [title, setTitle] = useState(SEED.jobOffer.title);
  const [company, setCompany] = useState(SEED.jobOffer.company);
  const [monthlySalary, setMonthlySalary] = useState(String(SEED.jobOffer.monthlySalary));
  const [workArrangement, setWorkArrangement] = useState<WorkArrangement>(
    SEED.jobOffer.workArrangement,
  );
  const [onsiteDaysPerWeek, setOnsiteDaysPerWeek] = useState(
    String(SEED.jobOffer.onsiteDaysPerWeek),
  );
  const [workingHoursPerDay, setWorkingHoursPerDay] = useState(
    String(SEED.jobOffer.workingHoursPerDay),
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<JobRealityAnalysis | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRemote = workArrangement === "remote";

  function handleArrangementChange(next: WorkArrangement) {
    setWorkArrangement(next);
    // Remote offers must report zero onsite days or the schema rejects them.
    if (next === "remote") setOnsiteDaysPerWeek("0");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      origin: DEMO_ORIGINS[originKey],
      jobOffer: {
        id: `job-${crypto.randomUUID()}`,
        title,
        company,
        monthlySalary: toNumber(monthlySalary),
        officeLocation: DEMO_OFFICES[officeKey],
        workArrangement,
        onsiteDaysPerWeek: toNumber(onsiteDaysPerWeek),
        workingHoursPerDay: toNumber(workingHoursPerDay),
      },
    };

    // Validated with the same schema the server uses, so the two can't drift.
    // The server still re-validates: this is a UX affordance, not a trust boundary.
    const parsed = analyzeJobOfferSchema.safeParse(payload);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path.join(".");
        errors[path] ??= messageFor(path, issue);
      }
      setFieldErrors(errors);
      setRequestError(null);
      setAnalysis(null);
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
        setAnalysis(result.data);
      } else {
        setAnalysis(null);
        setRequestError(result.error.message);
      }
    } catch {
      setAnalysis(null);
      setRequestError("Could not reach the analyzer. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function errorFor(path: string) {
    const message = fieldErrors[path];
    if (!message) return { node: null, props: {} };
    return {
      node: (
        <span id={`${formId}-${path}-error`} className={errorClass}>
          {message}
        </span>
      ),
      props: { "aria-invalid": true, "aria-describedby": `${formId}-${path}-error` },
    };
  }

  const salaryError = errorFor("jobOffer.monthlySalary");
  const titleError = errorFor("jobOffer.title");
  const companyError = errorFor("jobOffer.company");
  const onsiteError = errorFor("jobOffer.onsiteDaysPerWeek");
  const hoursError = errorFor("jobOffer.workingHoursPerDay");

  return (
    <>
      <section className="max-w-[760px] print:hidden">
        {children}
        <form onSubmit={handleSubmit} className="mt-10 grid gap-5" noValidate>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor={`${formId}-origin`}>
                Where you live
              </label>
              <select
                id={`${formId}-origin`}
                className={fieldClass}
                value={originKey}
                onChange={(event) => setOriginKey(event.target.value as DemoOriginKey)}
              >
                {ORIGIN_ENTRIES.map(([key, location]) => (
                  <option key={key} value={key}>
                    {location.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor={`${formId}-office`}>
                Office location
              </label>
              <select
                id={`${formId}-office`}
                className={fieldClass}
                value={officeKey}
                onChange={(event) => setOfficeKey(event.target.value as DemoOfficeKey)}
              >
                {OFFICE_ENTRIES.map(([key, location]) => (
                  <option key={key} value={key}>
                    {location.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor={`${formId}-title`}>
                Job title
              </label>
              <input
                id={`${formId}-title`}
                className={fieldClass}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                {...titleError.props}
              />
              {titleError.node}
            </div>
            <div>
              <label className={labelClass} htmlFor={`${formId}-company`}>
                Company
              </label>
              <input
                id={`${formId}-company`}
                className={fieldClass}
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                {...companyError.props}
              />
              {companyError.node}
            </div>
            <div>
              <label className={labelClass} htmlFor={`${formId}-salary`}>
                Monthly salary (₱)
              </label>
              <input
                id={`${formId}-salary`}
                className={fieldClass}
                type="number"
                inputMode="numeric"
                min={1}
                step={1000}
                value={monthlySalary}
                onChange={(event) => setMonthlySalary(event.target.value)}
                {...salaryError.props}
              />
              {salaryError.node}
            </div>
            <div>
              <label className={labelClass} htmlFor={`${formId}-arrangement`}>
                Work arrangement
              </label>
              <select
                id={`${formId}-arrangement`}
                className={fieldClass}
                value={workArrangement}
                onChange={(event) => handleArrangementChange(event.target.value as WorkArrangement)}
              >
                {WORK_ARRANGEMENTS.map((arrangement) => (
                  <option key={arrangement.value} value={arrangement.value}>
                    {arrangement.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor={`${formId}-onsite-days`}>
                Onsite days per week
              </label>
              <input
                id={`${formId}-onsite-days`}
                className={fieldClass}
                type="number"
                inputMode="numeric"
                min={0}
                max={5}
                step={1}
                value={onsiteDaysPerWeek}
                disabled={isRemote}
                onChange={(event) => setOnsiteDaysPerWeek(event.target.value)}
                {...onsiteError.props}
              />
              {onsiteError.node}
            </div>
            <div>
              <label className={labelClass} htmlFor={`${formId}-hours`}>
                Working hours per day
              </label>
              <input
                id={`${formId}-hours`}
                className={fieldClass}
                type="number"
                inputMode="decimal"
                min={0.5}
                max={24}
                step={0.5}
                value={workingHoursPerDay}
                onChange={(event) => setWorkingHoursPerDay(event.target.value)}
                {...hoursError.props}
              />
              {hoursError.node}
            </div>
          </div>
          <button
            type="submit"
            className="min-h-11 justify-self-start bg-accent px-8 py-3 font-black tracking-[0.08em] text-white uppercase disabled:opacity-60"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Analyzing…" : "Show the real cost"}
          </button>
        </form>
      </section>

      <div aria-live="polite">
        {analysis ? (
          <JobRealityReceipt analysis={analysis} />
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
