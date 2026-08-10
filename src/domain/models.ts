export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface Location {
  label: string;
  coordinate: Coordinate;
}

export type WorkArrangement = "onsite" | "hybrid" | "remote";

export interface JobOffer {
  id: string;
  title: string;
  company: string;
  monthlySalary: number;
  officeLocation: Location;
  workArrangement: WorkArrangement;
  onsiteDaysPerWeek: number;
  workingHoursPerDay: number;
}

export type DataSourceType = "official" | "gtfs" | "crowdsourced" | "estimated" | "demo";

export interface DataSource {
  type: DataSourceType;
  name: string;
  sourceUrl?: string;
  retrievedAt?: string;
  effectiveDate?: string;
  confidence?: "high" | "medium" | "low";
}

export type TransportMode =
  | "walk"
  | "jeepney"
  | "bus"
  | "rail"
  | "uv-express"
  | "p2p"
  | "tricycle"
  | "other";

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
  dailyFare: number;
  monthlyFare: number;
  annualFare: number;
  dailyMinutes: number;
  monthlyMinutes: number;
  annualMinutes: number;
}

export interface JobRealityAnalysis {
  jobOffer: JobOffer;
  commute: CommuteAnalysis;
  estimatedTakeHomePay: number;
  incomeAfterCommute: number;
  commuteBurdenPercentage: number;
  monthlyCommuteHours: number;
  effectiveHourlyValue: number;
  sources: DataSource[];
}
