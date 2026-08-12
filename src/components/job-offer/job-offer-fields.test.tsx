// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { JobOfferFields, type JobOfferFieldValues } from "@/components/job-offer/job-offer-fields";

afterEach(cleanup);

const BASE: JobOfferFieldValues = {
  officeKey: "bgc",
  title: "Software Developer",
  company: "Demo Tech Manila",
  monthlySalary: "70000",
  workArrangement: "hybrid",
  onsiteDaysPerWeek: "3",
  workingHoursPerDay: "8",
};

function renderFields(overrides: Partial<JobOfferFieldValues> = {}) {
  const onChange = vi.fn();
  render(
    <JobOfferFields
      idPrefix="test"
      values={{ ...BASE, ...overrides }}
      onChange={onChange}
      errors={{}}
    />,
  );
  return onChange;
}

/**
 * Picks an option out of the custom listbox, which is not a native select.
 *
 * The trigger is located by the label it currently displays rather than by
 * accessible name, because CustomSelect's trigger has none — see the note in
 * the a11y test below. Options commit on mousedown, not click, so the event
 * has to match or nothing happens.
 */
function selectOption(currentLabel: string, optionLabel: string) {
  const trigger = screen.getByText(currentLabel).closest("button");
  if (!trigger) throw new Error(`No select trigger currently showing "${currentLabel}"`);
  fireEvent.click(trigger);
  fireEvent.mouseDown(screen.getByRole("option", { name: optionLabel }));
}

describe("JobOfferFields — remote coercion", () => {
  it("zeroes onsite days when the arrangement becomes remote", () => {
    const onChange = renderFields({ onsiteDaysPerWeek: "3" });

    selectOption("Hybrid", "Fully remote");

    // The schema rejects a remote offer that still claims onsite days, so the
    // coercion has to travel with the arrangement change, not after it.
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ workArrangement: "remote", onsiteDaysPerWeek: "0" }),
    );
  });

  it("leaves onsite days alone when switching between onsite arrangements", () => {
    const onChange = renderFields({ workArrangement: "onsite", onsiteDaysPerWeek: "5" });

    selectOption("Fully onsite", "Hybrid");

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ workArrangement: "hybrid", onsiteDaysPerWeek: "5" }),
    );
  });

  it("disables the onsite days input while remote", () => {
    renderFields({ workArrangement: "remote", onsiteDaysPerWeek: "0" });

    expect(screen.getByLabelText(/ONSITE DAYS/i)).toHaveProperty("disabled", true);
  });
});

describe("JobOfferFields — controlled input", () => {
  it("emits the full value object on every edit, not a patch", () => {
    const onChange = renderFields();

    fireEvent.change(screen.getByLabelText(/JOB TITLE/i), { target: { value: "Data Analyst" } });

    expect(onChange).toHaveBeenCalledWith({ ...BASE, title: "Data Analyst" });
  });

  it("keeps numeric fields as strings so a blank stays blank", () => {
    const onChange = renderFields();

    fireEvent.change(screen.getByLabelText(/MONTHLY SALARY/i), { target: { value: "" } });

    // A blank must reach validation as a blank. Coercing here would turn an
    // empty salary into 0 and let it pass as a real number.
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ monthlySalary: "" }));
  });
});

describe("JobOfferFields — error surfacing", () => {
  it("marks a field invalid and links its message", () => {
    render(
      <JobOfferFields
        idPrefix="test"
        values={BASE}
        onChange={vi.fn()}
        errors={{ "jobOffer.title": "Add a job title." }}
      />,
    );

    const input = screen.getByLabelText(/JOB TITLE/i);

    expect(input.getAttribute("aria-invalid")).toBe("true");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)?.textContent).toBe("Add a job title.");
  });
});
