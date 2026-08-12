// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { JobComparison } from "@/components/comparison/job-comparison";
import { compareJobRealities } from "@/domain/job/comparison";
import { makeAnalysis, makeRemoteAnalysis } from "@/test/fixtures";
import type { JobRealityAnalysis } from "@/domain/models";

afterEach(cleanup);

/**
 * Builds a real comparison from the domain engine rather than a hand-made
 * metrics object, so a change to how `difference` is signed fails here instead
 * of passing against a fixture that encodes the old convention.
 */
function renderComparison(jobA: JobRealityAnalysis, jobB: JobRealityAnalysis) {
  return render(<JobComparison comparison={compareJobRealities(jobA, jobB)} />);
}

/**
 * The row that contains a given metric label, so assertions stay scoped.
 * The label is rendered twice per row — once per column — because the narrow
 * layout repeats it, so take the first and walk up to the shared row.
 */
function rowFor(label: string): HTMLElement {
  const labelNode = screen.getAllByText(label)[0];
  const row = labelNode.closest("div")?.parentElement;
  if (!row) throw new Error(`No row found for metric "${label}"`);
  return row;
}

describe("JobComparison — direction of better", () => {
  it("marks the higher offer better for income after commute", () => {
    renderComparison(
      makeAnalysis({ incomeAfterCommute: 50_000 }),
      makeAnalysis({ incomeAfterCommute: 60_000 }),
    );

    const row = rowFor("Income After Commute");
    const winners = within(row).getAllByText(/better on this measure/);

    expect(winners).toHaveLength(1);
    // The marker sits alongside the winning value, inside the same cell.
    expect(winners[0].parentElement?.textContent).toContain("₱60,000");
  });

  it("marks the LOWER offer better for monthly commute cost", () => {
    renderComparison(
      makeAnalysis({ commute: { ...makeAnalysis().commute, monthlyFare: 1_000 } }),
      makeAnalysis({ commute: { ...makeAnalysis().commute, monthlyFare: 5_000 } }),
    );

    const winners = within(rowFor("Monthly Commute Cost")).getAllByText(/better on this measure/);

    expect(winners).toHaveLength(1);
    expect(winners[0].parentElement?.textContent).toContain("₱1,000");
  });

  it("marks the LOWER offer better for commute burden", () => {
    renderComparison(
      makeAnalysis({ commuteBurdenPercentage: 3.2 }),
      makeAnalysis({ commuteBurdenPercentage: 14.7 }),
    );

    const winners = within(rowFor("Commute Burden")).getAllByText(/better on this measure/);

    expect(winners).toHaveLength(1);
    expect(winners[0].parentElement?.textContent).toContain("3.2%");
  });

  it("marks the LOWER offer better for monthly commute hours", () => {
    renderComparison(
      makeAnalysis({ monthlyCommuteHours: 12 }),
      makeAnalysis({ monthlyCommuteHours: 48 }),
    );

    const winners = within(rowFor("Monthly Commute Hours")).getAllByText(/better on this measure/);

    expect(winners[0].parentElement?.textContent).toContain("12.0 hrs");
  });

  it("marks neither offer better when the two are equal", () => {
    renderComparison(
      makeAnalysis({ incomeAfterCommute: 55_000 }),
      makeAnalysis({ incomeAfterCommute: 55_000 }),
    );

    const row = rowFor("Income After Commute");

    expect(within(row).queryByText(/better on this measure/)).toBeNull();
    expect(row.textContent).toContain("—");
  });
});

describe("JobComparison — units", () => {
  it("reports a burden gap in percentage points, not percent", () => {
    renderComparison(
      makeAnalysis({ commuteBurdenPercentage: 4 }),
      makeAnalysis({ commuteBurdenPercentage: 9.5 }),
    );

    // 9.5% minus 4% is 5.5 percentage points. Rendering it as "5.5%" would
    // claim the gap is itself a percentage of something.
    expect(rowFor("Commute Burden").textContent).toContain("5.5 pts");
  });
});

describe("JobComparison — provenance", () => {
  it("discloses the weakest source behind either offer", () => {
    renderComparison(makeAnalysis(), makeAnalysis());

    expect(screen.getByText(/Curated demo data for this prototype/)).toBeTruthy();
    expect(screen.getByText(/Not payroll, tax, or financial advice/)).toBeTruthy();
  });

  it("still discloses when neither offer has a source", () => {
    // Two fully remote offers route nothing, so no transit source exists. The
    // take-home figures are still estimates and must not lose their label.
    renderComparison(makeRemoteAnalysis(), makeRemoteAnalysis());

    expect(screen.getByText("Estimated")).toBeTruthy();
    expect(screen.getByText(/Not payroll, tax, or financial advice/)).toBeTruthy();
  });
});

describe("JobComparison — scope", () => {
  it("does not declare an overall winner", () => {
    renderComparison(
      makeAnalysis({ incomeAfterCommute: 40_000 }),
      makeAnalysis({ incomeAfterCommute: 90_000 }),
    );

    // Picking one offer overall is a domain judgement. The model carries no
    // verdict field, so the component must not invent one.
    expect(screen.queryByText(/better offer|wins overall|recommended|choose job/i)).toBeNull();
  });
});
