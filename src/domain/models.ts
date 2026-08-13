export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface Location {
  label: string;
  coordinate: Coordinate;
}

import type {
  PhilippinePayrollEstimate,
  PayrollDeductionSelection,
} from "@/domain/finance/philippine-payroll";
import type { WeeklyWorkSchedule } from "@/domain/work-schedule";

export type WorkArrangement = "onsite" | "hybrid" | "remote";

export interface JobOffer {
  id: string;
  title: string;
  company: string;
  monthlySalary: number;
  officeLocation: Location;
  workArrangement: WorkArrangement;
  onsiteDaysPerWeek: number;
  /** Onsite plus WFH days. Defaults to the legacy five-day week when absent. */
  workingDaysPerWeek?: number;
  weeklySchedule?: WeeklyWorkSchedule;
  workingHoursPerDay: number;
  /** Versioned Philippine employee deduction selection used for the automatic estimate. */
  payrollDeductions?: PayrollDeductionSelection;
  /** Legacy compatibility for older API clients that still provide a manual rate. */
  estimatedTakeHomeRate?: number;
}

export type DataSourceType = "official" | "gtfs" | "crowdsourced" | "estimated" | "demo";

export interface DataSource {
  type: DataSourceType;
  name: string;
  sourceUrl?: string;
  retrievedAt?: string;
  effectiveDate?: string;
  /** Whether routing data reflects a live service, a static timetable, or an archived pattern. */
  freshness?: "realtime" | "static" | "archival";
  confidence?: "high" | "medium" | "low";
}

export type TransportMode =
  "walk" | "jeepney" | "bus" | "rail" | "uv-express" | "p2p" | "tricycle" | "other";

export interface CommuteSegment {
  mode: TransportMode;
  origin: Location;
  destination: Location;
  estimatedFare: number;
  estimatedDurationMinutes: number;
  source: DataSource;
}

export interface CommuteRoute {
  id: string;
  segments: CommuteSegment[];
  oneWayFare: number;
  oneWayDurationMinutes: number;
  transfers: number;
  reliability: "high" | "medium" | "low";
  sources: DataSource[];
}

export interface CommuteAnalysis {
  route: CommuteRoute | null;
  segments: CommuteSegment[];
  oneWayFare: number;
  dailyFare: number;
  monthlyFare: number;
  annualFare: number;
  oneWayMinutes: number;
  dailyMinutes: number;
  monthlyMinutes: number;
  annualMinutes: number;
  officeDaysPerMonth: number;
}

export type FareDiscountClassName = "regular" | "student" | "senior" | "pwd";

export interface JobRealityAnalysis {
  origin: Location;
  jobOffer: JobOffer;
  /** Statutory fare entitlement the commute was priced with. */
  fareDiscountClass: FareDiscountClassName;
  commute: CommuteAnalysis;
  payrollEstimate?: PhilippinePayrollEstimate;
  estimatedTakeHomePay: number;
  incomeAfterCommute: number;
  commuteBurdenPercentage: number;
  monthlyCommuteHours: number;
  monthlyWorkHours: number;
  effectiveMonthlyHours: number;
  effectiveHourlyValue: number;
  sources: DataSource[];
}

export interface ComparedMetric {
  jobA: number;
  jobB: number;
  difference: number;
}

export interface JobRealityComparison {
  jobA: JobRealityAnalysis;
  jobB: JobRealityAnalysis;
  metrics: {
    monthlySalary: ComparedMetric;
    estimatedTakeHomePay: ComparedMetric;
    monthlyCommuteCost: ComparedMetric;
    monthlyCommuteHours: ComparedMetric;
    incomeAfterCommute: ComparedMetric;
    commuteBurdenPercentage: ComparedMetric;
    effectiveHourlyValue: ComparedMetric;
  };
}
