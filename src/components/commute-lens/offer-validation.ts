import { countWorkingDays } from "@/domain/work-schedule";

/**
 * Client-side validation for the offer form.
 *
 * This is a UX affordance, not a trust boundary: `analyzeJobOfferSchema` on the
 * server remains the authority. The bounds below deliberately mirror it so a
 * user never gets bounced by a rule the form did not warn about first.
 *
 * Messages are written to be told to a person, not to a validator.
 */

export interface OfferDraft {
  title: string;
  company: string;
  salary: string;
  workingHours: string;
  /** Legacy hidden value kept while older API clients migrate. */
  takeHomePercent: string;
  payrollDeductions?: import("@/domain/finance/philippine-payroll").PayrollDeductionSelection;
  weeklySchedule?: import("@/domain/work-schedule").WeeklyWorkSchedule;
}

export type OfferField = keyof OfferDraft;

export type OfferFieldErrors = Partial<Record<OfferField, string>>;

/** Mirrors `estimatedTakeHomeRate: z.number().min(0.5).max(1)`. */
export const TAKE_HOME_MIN_PERCENT = 50;
export const TAKE_HOME_MAX_PERCENT = 100;
export const MAX_WORKING_HOURS_PER_DAY = 24;

function toNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateOfferDraft(draft: OfferDraft): OfferFieldErrors {
  const errors: OfferFieldErrors = {};

  if (draft.title.trim() === "") {
    errors.title = "Add the role title so the receipt says what this offer is.";
  }

  if (draft.company.trim() === "") {
    errors.company = "Add the company name.";
  }

  const salary = toNumber(draft.salary);
  if (salary === null) {
    errors.salary = "Enter the gross monthly salary.";
  } else if (salary <= 0) {
    errors.salary = "Gross monthly salary needs to be more than zero.";
  }

  const hours = toNumber(draft.workingHours);
  if (hours === null) {
    errors.workingHours = "Enter how many hours you work each day.";
  } else if (hours <= 0) {
    errors.workingHours = "Working hours need to be more than zero.";
  } else if (hours > MAX_WORKING_HOURS_PER_DAY) {
    errors.workingHours = `A day only holds ${MAX_WORKING_HOURS_PER_DAY} hours.`;
  }

  const takeHome = toNumber(draft.takeHomePercent);
  if (takeHome === null) {
    errors.takeHomePercent = "Enter your estimated take-home percentage.";
  } else if (takeHome < TAKE_HOME_MIN_PERCENT || takeHome > TAKE_HOME_MAX_PERCENT) {
    errors.takeHomePercent = `Use a value between ${TAKE_HOME_MIN_PERCENT}% and ${TAKE_HOME_MAX_PERCENT}%.`;
  }

  if (draft.weeklySchedule && countWorkingDays(draft.weeklySchedule) === 0) {
    errors.weeklySchedule = "Select at least one working day.";
  }

  return errors;
}

export function firstErrorField(errors: OfferFieldErrors): OfferField | null {
  const order: OfferField[] = [
    "title",
    "company",
    "salary",
    "weeklySchedule",
    "workingHours",
    "takeHomePercent",
  ];
  return order.find((field) => errors[field] !== undefined) ?? null;
}

export function countErrors(errors: OfferFieldErrors): number {
  return Object.keys(errors).length;
}

/** The single summary line shown above the submit button after a failed attempt. */
export function summariseErrors(errors: OfferFieldErrors): string | null {
  const count = countErrors(errors);
  if (count === 0) return null;
  return count === 1
    ? "One field still needs attention before we can calculate."
    : `${count} fields still need attention before we can calculate.`;
}
