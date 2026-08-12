import { CustomSelect } from "@/components/ui/custom-select";
import { fieldClass, errorClass, labelClass } from "@/components/ui/form-styles";
import { DEMO_OFFICES, type DemoOfficeKey } from "@/data/demo";
import type { Location, WorkArrangement } from "@/domain/models";

const OFFICE_ENTRIES = Object.entries(DEMO_OFFICES) as [DemoOfficeKey, Location][];

const WORK_ARRANGEMENTS: readonly { value: WorkArrangement; label: string }[] = [
  { value: "onsite", label: "Fully onsite" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Fully remote" },
];

export interface JobOfferFieldValues {
  officeKey: DemoOfficeKey;
  title: string;
  company: string;
  monthlySalary: string;
  workArrangement: WorkArrangement;
  onsiteDaysPerWeek: string;
  workingHoursPerDay: string;
}

interface JobOfferFieldsProps {
  idPrefix: string;
  values: JobOfferFieldValues;
  onChange: (next: JobOfferFieldValues) => void;
  /** Keyed by path, e.g. "jobOffer.title", "jobOffer.monthlySalary". */
  errors: Record<string, string>;
}

/**
 * Controlled per-offer form fields. The parent owns state; this component
 * renders the seven offer-specific inputs and emits updated values via onChange.
 *
 * The remote coercion lives here: when workArrangement becomes "remote", the
 * emitted next also sets onsiteDaysPerWeek to "0".
 */
export function JobOfferFields({ idPrefix, values, onChange, errors }: JobOfferFieldsProps) {
  const isRemote = values.workArrangement === "remote";

  function emit(patch: Partial<JobOfferFieldValues>) {
    const next = { ...values, ...patch };
    // Remote offers must report zero onsite days or the schema rejects them.
    if (next.workArrangement === "remote" && patch.workArrangement === "remote") {
      next.onsiteDaysPerWeek = "0";
    }
    onChange(next);
  }

  function errorFor(path: string) {
    const message = errors[path];
    if (!message) return { node: null, props: {} as Record<string, unknown> };
    return {
      node: (
        <span id={`${idPrefix}-${path}-error`} className={errorClass}>
          {message}
        </span>
      ),
      props: {
        "aria-invalid": true as const,
        "aria-describedby": `${idPrefix}-${path}-error`,
      },
    };
  }

  const titleError = errorFor("jobOffer.title");
  const companyError = errorFor("jobOffer.company");
  const salaryError = errorFor("jobOffer.monthlySalary");
  const onsiteError = errorFor("jobOffer.onsiteDaysPerWeek");
  const hoursError = errorFor("jobOffer.workingHoursPerDay");

  return (
    <>
      <CustomSelect
        id={`${idPrefix}-office`}
        label="OFFICE LOCATION"
        options={OFFICE_ENTRIES.map(([key, location]) => ({
          value: key,
          label: location.label,
        }))}
        value={values.officeKey}
        onChange={(val) => emit({ officeKey: val as DemoOfficeKey })}
      />
      <div>
        <label className={labelClass} htmlFor={`${idPrefix}-title`}>
          JOB TITLE
        </label>
        <input
          id={`${idPrefix}-title`}
          className={fieldClass}
          placeholder="e.g. Software Developer"
          value={values.title}
          onChange={(event) => emit({ title: event.target.value })}
          {...titleError.props}
        />
        {titleError.node}
      </div>
      <div>
        <label className={labelClass} htmlFor={`${idPrefix}-company`}>
          COMPANY
        </label>
        <input
          id={`${idPrefix}-company`}
          className={fieldClass}
          placeholder="e.g. Acme Corp"
          value={values.company}
          onChange={(event) => emit({ company: event.target.value })}
          {...companyError.props}
        />
        {companyError.node}
      </div>
      <div>
        <label className={labelClass} htmlFor={`${idPrefix}-salary`}>
          MONTHLY SALARY (₱)
        </label>
        <input
          id={`${idPrefix}-salary`}
          className={fieldClass}
          type="number"
          inputMode="numeric"
          min={1}
          step={1000}
          placeholder="45000"
          value={values.monthlySalary}
          onChange={(event) => emit({ monthlySalary: event.target.value })}
          {...salaryError.props}
        />
        {salaryError.node}
      </div>
      <CustomSelect
        id={`${idPrefix}-arrangement`}
        label="WORK ARRANGEMENT"
        options={WORK_ARRANGEMENTS.map((a) => ({ value: a.value, label: a.label }))}
        value={values.workArrangement}
        onChange={(val) => emit({ workArrangement: val as WorkArrangement })}
      />
      <div>
        <label className={labelClass} htmlFor={`${idPrefix}-onsite-days`}>
          ONSITE DAYS / WEEK
        </label>
        <input
          id={`${idPrefix}-onsite-days`}
          className={fieldClass}
          type="number"
          inputMode="numeric"
          min={0}
          max={5}
          step={1}
          placeholder="3"
          value={values.onsiteDaysPerWeek}
          disabled={isRemote}
          onChange={(event) => emit({ onsiteDaysPerWeek: event.target.value })}
          {...onsiteError.props}
        />
        {onsiteError.node}
      </div>
      <div>
        <label className={labelClass} htmlFor={`${idPrefix}-hours`}>
          HOURS / DAY
        </label>
        <input
          id={`${idPrefix}-hours`}
          className={fieldClass}
          type="number"
          inputMode="decimal"
          min={0.5}
          max={24}
          step={0.5}
          placeholder="8"
          value={values.workingHoursPerDay}
          onChange={(event) => emit({ workingHoursPerDay: event.target.value })}
          {...hoursError.props}
        />
        {hoursError.node}
      </div>
    </>
  );
}
