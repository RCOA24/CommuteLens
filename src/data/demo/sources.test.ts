import { describe, expect, it } from "vitest";
import { DEMO_SCENARIOS, DEMO_SOURCE, ESTIMATED_SOURCE, summarizeProvenance } from "./index";

describe("summarizeProvenance", () => {
  it("returns null when there are no sources", () => {
    expect(summarizeProvenance([])).toBeNull();
  });

  it("headlines the weakest source present", () => {
    const summary = summarizeProvenance([ESTIMATED_SOURCE, DEMO_SOURCE]);
    expect(summary?.weakest.type).toBe("demo");
    expect(summary?.requiresDisclosure).toBe(true);
  });

  it("deduplicates source names for the receipt footer", () => {
    const summary = summarizeProvenance([DEMO_SOURCE, DEMO_SOURCE, ESTIMATED_SOURCE]);
    expect(summary?.sourceNames).toHaveLength(2);
  });

  it("flags demo and estimated data as requiring disclosure", () => {
    expect(summarizeProvenance([DEMO_SOURCE])?.requiresDisclosure).toBe(true);
    expect(summarizeProvenance([{ type: "official", name: "Operator" }])?.requiresDisclosure).toBe(
      false,
    );
  });
});

describe("demo seed scenarios", () => {
  it("has unique ids", () => {
    const ids = DEMO_SCENARIOS.map((scenario) => scenario.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps remote scenarios at zero onsite days", () => {
    for (const scenario of DEMO_SCENARIOS) {
      if (scenario.jobOffer.workArrangement === "remote") {
        expect(scenario.jobOffer.onsiteDaysPerWeek).toBe(0);
      }
    }
  });

  it("includes an unsupported-corridor rehearsal case", () => {
    expect(DEMO_SCENARIOS.some((scenario) => scenario.id === "unsupported-corridor")).toBe(true);
  });
});
