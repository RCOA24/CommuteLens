import type { DataSource, JobRealityAnalysis, Location } from "@/domain/models";

/**
 * Fixtures for component tests.
 *
 * These are hand-written rather than produced by the engines on purpose: a
 * component test should fail when the component misreads a value, not when an
 * engine changes one. Numbers here are illustrative and need not be internally
 * consistent — the components are display-only and never recompute them.
 */

const MANILA: Location = {
  label: "Cubao, Quezon City",
  coordinate: { latitude: 14.6229, longitude: 121.0538 },
};

const OFFICE: Location = {
  label: "BGC, Taguig",
  coordinate: { latitude: 14.5507, longitude: 121.0501 },
};

export const DEMO_SOURCE: DataSource = {
  type: "demo",
  name: "Commute Lens curated CUTC scenario",
  effectiveDate: "2026-01-05",
  confidence: "medium",
};

/** Weaker than the curated source, and dated later, so ordering is testable. */
export const ESTIMATED_SOURCE: DataSource = {
  type: "estimated",
  name: "Commute Lens estimated Metro Manila fare band",
  effectiveDate: "2026-03-20",
  confidence: "low",
};

export function makeAnalysis(overrides: Partial<JobRealityAnalysis> = {}): JobRealityAnalysis {
  return {
    jobOffer: {
      id: "job-fixture-0001ab",
      title: "Software Developer",
      company: "Demo Tech Manila",
      monthlySalary: 70_000,
      officeLocation: OFFICE,
      workArrangement: "hybrid",
      onsiteDaysPerWeek: 3,
      workingHoursPerDay: 8,
    },
    commute: {
      route: null,
      segments: [
        {
          mode: "rail",
          origin: MANILA,
          destination: OFFICE,
          estimatedFare: 28,
          estimatedDurationMinutes: 35,
          source: DEMO_SOURCE,
        },
      ],
      oneWayFare: 28,
      dailyFare: 56,
      monthlyFare: 728,
      annualFare: 8_736,
      oneWayMinutes: 35,
      dailyMinutes: 70,
      monthlyMinutes: 910,
      annualMinutes: 10_920,
      officeDaysPerMonth: 13,
    },
    estimatedTakeHomePay: 63_000,
    incomeAfterCommute: 62_272,
    commuteBurdenPercentage: 1.8,
    monthlyCommuteHours: 15.2,
    monthlyWorkHours: 176,
    effectiveMonthlyHours: 191.2,
    effectiveHourlyValue: 325.69,
    sources: [DEMO_SOURCE],
    ...overrides,
  };
}

/**
 * A route whose legs do not share provenance: one curated, one only estimated
 * from a published fare band. Real demo routes mix like this, and it is the
 * case a single route-level badge would hide.
 */
export function makeMixedAnalysis(): JobRealityAnalysis {
  const base = makeAnalysis();
  return makeAnalysis({
    commute: {
      ...base.commute,
      segments: [
        { ...base.commute.segments[0], mode: "jeepney", source: ESTIMATED_SOURCE },
        { ...base.commute.segments[0], mode: "rail", source: DEMO_SOURCE },
      ],
    },
    sources: [DEMO_SOURCE, ESTIMATED_SOURCE],
  });
}

/** A fully remote offer: nothing routed, so no transit source exists. */
export function makeRemoteAnalysis(): JobRealityAnalysis {
  return makeAnalysis({
    jobOffer: {
      ...makeAnalysis().jobOffer,
      id: "job-remote-0002cd",
      workArrangement: "remote",
      onsiteDaysPerWeek: 0,
    },
    commute: {
      ...makeAnalysis().commute,
      segments: [],
      oneWayFare: 0,
      dailyFare: 0,
      monthlyFare: 0,
      annualFare: 0,
      oneWayMinutes: 0,
      dailyMinutes: 0,
      monthlyMinutes: 0,
      annualMinutes: 0,
      officeDaysPerMonth: 0,
    },
    commuteBurdenPercentage: 0,
    monthlyCommuteHours: 0,
    sources: [],
  });
}
