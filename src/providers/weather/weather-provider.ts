import type { DataSource, Location } from "@/domain/models";

export interface DailyWeatherForecast {
  areaLabel: string;
  municipality: string;
  province: string;
  date: string;
  rainfallMillimetres: number;
  rainfallDescription: string;
  cloudCover: string | null;
  minimumTemperatureCelsius: number | null;
  maximumTemperatureCelsius: number | null;
  humidityPercent: number | null;
  windSpeedMetresPerSecond: number | null;
  windDirection: string | null;
  source: DataSource;
}

export interface WeatherProvider {
  getDailyForecast(input: { location: Location; date: string }): Promise<DailyWeatherForecast>;
}

export class WeatherProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeatherProviderError";
  }
}
