import type { JobOffer, Location } from "@/domain/models";
import { DEMO_OFFICES, DEMO_ORIGINS } from "./locations";

/**
 * CL-016 — deterministic demo seed scenarios.
 *
 * Every member develops and rehearses against these exact inputs so the numbers
 * shown on stage are reproducible. Values here are inputs only: no fares,
 * durations, or scores live in this file. Those come from the curated dataset
 * and the Member 1 engines.
 */

export interface DemoScenario {
  id: string;
  /** Short name for the scenario picker. */
  title: string;
  /** One line explaining what this scenario demonstrates. */
  narrative: string;
  origin: Location;
  jobOffer: JobOffer;
}

export const DEMO_SCENARIOS: readonly DemoScenario[] = [
  {
    id: "hero-cubao-bgc-hybrid",
    title: "Hero — Cubao to BGC, hybrid",
    narrative:
      "The rehearsed CUTC scenario. A well-paid hybrid developer role whose commute cost and hours are still material.",
    origin: DEMO_ORIGINS.cubao,
    jobOffer: {
      id: "job-hero-bgc",
      title: "Software Developer",
      company: "Demo Tech Manila",
      monthlySalary: 70_000,
      officeLocation: DEMO_OFFICES.bgc,
      workArrangement: "hybrid",
      onsiteDaysPerWeek: 3,
      workingHoursPerDay: 8,
    },
  },
  {
    id: "compare-b-alabang-bgc-onsite",
    title: "Comparison B — Alabang to BGC, fully onsite",
    narrative:
      "Higher headline salary, five onsite days, and a P2P-heavy route. Pairs with the hero scenario for Job A vs Job B.",
    origin: DEMO_ORIGINS.alabang,
    jobOffer: {
      id: "job-compare-bgc",
      title: "Senior Software Developer",
      company: "Demo Systems Inc.",
      monthlySalary: 85_000,
      officeLocation: DEMO_OFFICES.bgc,
      workArrangement: "onsite",
      onsiteDaysPerWeek: 5,
      workingHoursPerDay: 8,
    },
  },
  {
    id: "worst-case-antipolo-bgc-onsite",
    title: "Worst case — Antipolo to BGC, fully onsite",
    narrative:
      "Five segments and a long corridor. Demonstrates how commute burden can erase a salary increase.",
    origin: DEMO_ORIGINS.antipolo,
    jobOffer: {
      id: "job-antipolo-bgc",
      title: "Data Analyst",
      company: "Demo Analytics Co.",
      monthlySalary: 55_000,
      officeLocation: DEMO_OFFICES.bgc,
      workArrangement: "onsite",
      onsiteDaysPerWeek: 5,
      workingHoursPerDay: 8,
    },
  },
  {
    id: "short-commute-cainta-ortigas",
    title: "Short commute — Cainta to Ortigas",
    narrative:
      "A lower salary that survives the commute test. Useful counterexample so the demo is not one-sided.",
    origin: DEMO_ORIGINS.cainta,
    jobOffer: {
      id: "job-cainta-ortigas",
      title: "QA Engineer",
      company: "Demo Quality Labs",
      monthlySalary: 48_000,
      officeLocation: DEMO_OFFICES.ortigas,
      workArrangement: "hybrid",
      onsiteDaysPerWeek: 2,
      workingHoursPerDay: 8,
    },
  },
  {
    id: "remote-baseline",
    title: "Remote baseline",
    narrative:
      "Zero onsite days. Proves the engine reports no commute cost or time rather than a stale route.",
    origin: DEMO_ORIGINS.fairview,
    jobOffer: {
      id: "job-remote",
      title: "Backend Developer",
      company: "Demo Remote Works",
      monthlySalary: 60_000,
      officeLocation: DEMO_OFFICES.bgc,
      workArrangement: "remote",
      onsiteDaysPerWeek: 0,
      workingHoursPerDay: 8,
    },
  },
  {
    id: "unsupported-corridor",
    title: "Unsupported corridor",
    narrative:
      "An origin outside the curated dataset. Rehearses the ROUTE_NOT_FOUND state instead of hiding it on stage.",
    origin: {
      label: "Baguio City, Benguet",
      coordinate: { latitude: 16.4023, longitude: 120.596 },
    },
    jobOffer: {
      id: "job-unsupported",
      title: "Software Developer",
      company: "Demo Tech Manila",
      monthlySalary: 70_000,
      officeLocation: DEMO_OFFICES.bgc,
      workArrangement: "onsite",
      onsiteDaysPerWeek: 5,
      workingHoursPerDay: 8,
    },
  },
];

/** The scenario shown first and used in rehearsal. */
export const PRIMARY_DEMO_SCENARIO = DEMO_SCENARIOS[0];

export function findDemoScenario(id: string): DemoScenario | undefined {
  return DEMO_SCENARIOS.find((scenario) => scenario.id === id);
}
