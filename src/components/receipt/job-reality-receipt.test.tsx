// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { JobRealityReceipt } from "@/components/receipt/job-reality-receipt";
import { makeAnalysis, makeMixedAnalysis, makeRemoteAnalysis } from "@/test/fixtures";

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

describe("JobRealityReceipt — per-segment provenance", () => {
  it("labels every segment, not just the route as a whole", () => {
    render(<JobRealityReceipt analysis={makeMixedAnalysis()} issuedAt={ISSUED} />);

    const segments = screen.getAllByRole("listitem");
    // The destination row is a listitem too and carries no source of its own.
    const labelled = segments.filter((s) => within(s).queryByText(/Data source:/));

    expect(labelled).toHaveLength(2);
  });

  it("distinguishes a curated leg from an estimated one", () => {
    render(<JobRealityReceipt analysis={makeMixedAnalysis()} issuedAt={ISSUED} />);

    // A route-level badge alone would render both legs identically and let the
    // estimated fare inherit the credibility of the curated one.
    const tags = screen.getAllByText(/Data source:/).map((node) => node.parentElement?.textContent);

    expect(tags).toContain("Data source: Estimated");
    expect(tags).toContain("Data source: Demo");
  });

  it("names the source type in full for assistive tech and hover", () => {
    render(<JobRealityReceipt analysis={makeAnalysis()} issuedAt={ISSUED} />);

    const tag = screen.getByText(/Data source:/).parentElement;

    // The visible text is abbreviated for an 80mm receipt; the full descriptor
    // must still be reachable rather than lost to the abbreviation.
    expect(tag?.getAttribute("title")).toBe("Curated demo data");
  });
});

describe("JobRealityReceipt — data vintage", () => {
  it("dates the disclosure by the oldest source, not the newest", () => {
    render(<JobRealityReceipt analysis={makeMixedAnalysis()} issuedAt={ISSUED} />);

    // Sources are dated Jan and Mar 2026. Claiming Mar would present the whole
    // receipt as fresher than its oldest input.
    expect(screen.getByText(/Data as of Jan 2026/)).toBeTruthy();
  });

  it("omits the claim when no source dates itself", () => {
    const analysis = makeAnalysis({ sources: [{ type: "demo", name: "Undated demo source" }] });
    render(<JobRealityReceipt analysis={analysis} issuedAt={ISSUED} />);

    expect(screen.queryByText(/Data as of/)).toBeNull();
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
