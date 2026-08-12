// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { JobRealityReceipt } from "@/components/receipt/job-reality-receipt";
import { makeAnalysis, makeRemoteAnalysis } from "@/test/fixtures";

afterEach(cleanup);

const ISSUED = new Date("2026-08-12T09:00:00+08:00");

describe("JobRealityReceipt — provenance", () => {
  it("discloses the source behind a routed commute", () => {
    render(<JobRealityReceipt analysis={makeAnalysis()} issuedAt={ISSUED} />);

    expect(screen.getByText(/Curated demo data for this prototype/)).toBeTruthy();
    expect(screen.getByText(/Not payroll, tax, or financial advice/)).toBeTruthy();
  });

  it("still discloses when a remote offer routes nothing", () => {
    render(<JobRealityReceipt analysis={makeRemoteAnalysis()} issuedAt={ISSUED} />);

    // No commute means no transit source, but take-home is still an estimate.
    expect(screen.getByText("ESTIMATED")).toBeTruthy();
    expect(screen.getByText(/This offer has no onsite commute/)).toBeTruthy();
  });

  it("omits the route section when there are no segments", () => {
    render(<JobRealityReceipt analysis={makeRemoteAnalysis()} issuedAt={ISSUED} />);

    expect(screen.queryByText("ROUTE")).toBeNull();
    expect(screen.queryByLabelText("Commute route segments")).toBeNull();
  });
});

describe("JobRealityReceipt — purity", () => {
  it("issues the date from the prop rather than the clock", () => {
    render(
      <JobRealityReceipt analysis={makeAnalysis()} issuedAt={new Date("2020-01-02T00:00:00Z")} />,
    );

    // Reading the clock during render would make this un-assertable and would
    // change the receipt on every re-render.
    expect(screen.getByText(/Jan 2020|02 Jan 2020|Jan 02, 2020/)).toBeTruthy();
  });

  it("derives a stable ticket number from the offer id", () => {
    const analysis = makeAnalysis();
    const { unmount } = render(<JobRealityReceipt analysis={analysis} issuedAt={ISSUED} />);
    const first = screen.getByText(/^NO\. /).textContent;
    unmount();

    render(<JobRealityReceipt analysis={analysis} issuedAt={ISSUED} />);

    expect(screen.getByText(/^NO\. /).textContent).toBe(first);
  });
});

describe("JobRealityReceipt — display only", () => {
  it("renders the figures it was given without recomputing them", () => {
    render(
      <JobRealityReceipt
        analysis={makeAnalysis({ incomeAfterCommute: 12_345, commuteBurdenPercentage: 9.4 })}
        issuedAt={ISSUED}
      />,
    );

    expect(screen.getByText("₱12,345")).toBeTruthy();
    expect(screen.getByText("9.4%")).toBeTruthy();
  });
});
