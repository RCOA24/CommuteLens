import type { RouteFrictionProfile } from "@/domain/readiness/route-friction";
import { calculateRouteFriction } from "@/domain/readiness/route-friction";
import type { CommuteRoute, DataSource } from "@/domain/models";
import type { DailyWeatherForecast, WeatherProvider } from "@/providers/weather";
export type CommuteReadinessAvailability = "available" | "limited" | "not-applicable";
export type CommuteReadinessLevel = "standard" | "higher-friction" | "limited" | "not-applicable";
export interface WeatherReadiness {
  availability: "available" | "unavailable" | "not-applicable";
  forecast: DailyWeatherForecast | null;
  message: string | null;
}
/**
 * A transient environmental layer over a selected route. It does not alter the
 * route, fare, salary, or travel-time calculations that produced the analysis.
 */
export interface CommuteReadiness {
  availability: CommuteReadinessAvailability;
  level: CommuteReadinessLevel;
  travelDate: string;
  assessedAt: string;
  friction: RouteFrictionProfile | null;
  weather: WeatherReadiness;
  hazard: {
    availability: "coming-soon";
    message: "Hazard context coming soon. We will only add map layers once their source, coverage, and usage rights are verified.";
  };
  sources: readonly DataSource[];
}
export class AssessCommuteReadinessUseCase {
  constructor(private readonly weatherProvider: WeatherProvider) {}
  async execute(input: {
    route: CommuteRoute | null;
    travelDate?: string;
  }): Promise<CommuteReadiness> {
    const travelDate = input.travelDate ?? currentPhilippineDate();
    const assessedAt = new Date().toISOString();
    if (!input.route) {
      return {
        availability: "not-applicable",
        level: "not-applicable",
        travelDate,
        assessedAt,
        friction: null,
        weather: {
          availability: "not-applicable",
          forecast: null,
          message: "There is no office commute to assess for this schedule.",
        },
        hazard: HAZARD_COMING_SOON,
        sources: [],
      };
    }
    const friction = calculateRouteFriction(input.route);
    const destination = input.route.segments.at(-1)?.destination;
    if (!destination) {
      return unavailableWeatherReadiness({ travelDate, assessedAt, friction });
    }
    try {
      const forecast = await this.weatherProvider.getDailyForecast({
        location: destination,
        date: travelDate,
      });
      const level = readinessLevel(friction, forecast);
      return {
        availability: level === "limited" ? "limited" : "available",
        level,
        travelDate,
        assessedAt,
        friction,
        weather: { availability: "available", forecast, message: null },
        hazard: HAZARD_COMING_SOON,
        sources: [forecast.source],
      };
    } catch {
      return unavailableWeatherReadiness({ travelDate, assessedAt, friction });
    }
  }
}
const HAZARD_COMING_SOON = {
  availability: "coming-soon" as const,
  message:
    "Hazard context coming soon. We will only add map layers once their source, coverage, and usage rights are verified." as const,
};
function unavailableWeatherReadiness(input: {
  travelDate: string;
  assessedAt: string;
  friction: RouteFrictionProfile;
}): CommuteReadiness {
  return {
    availability: "limited",
    level: "limited",
    travelDate: input.travelDate,
    assessedAt: input.assessedAt,
    friction: input.friction,
    weather: {
      availability: "unavailable",
      forecast: null,
      message:
        "PAGASA weather context is temporarily unavailable. Route friction remains available below.",
    },
    hazard: HAZARD_COMING_SOON,
    sources: [],
  };
}
function readinessLevel(
  friction: RouteFrictionProfile,
  forecast: DailyWeatherForecast,
): CommuteReadinessLevel {
  if (friction.routeDetail !== "observed") return "limited";
  const hasOutdoorExposure =
    (friction.walkingMinutes ?? 0) > 0 || (friction.transferCount ?? 0) > 0;
  const rainForecast =
    forecast.rainfallMillimetres > 0 || !isNoRainDescription(forecast.rainfallDescription);
  const hotConditions = (forecast.maximumTemperatureCelsius ?? 0) >= 35;
  return (rainForecast && hasOutdoorExposure) || hotConditions ? "higher-friction" : "standard";
}
function isNoRainDescription(description: string): boolean {
  return /\b(no|none|zero)\b.*\brain/i.test(description);
}
/** The public forecast is Philippine-local, so avoid a server's UTC date near midnight. */
export function currentPhilippineDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
