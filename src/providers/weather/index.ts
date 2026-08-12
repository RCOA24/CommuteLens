import { PagasaWeatherProvider } from "./pagasa-weather.provider";
import type { WeatherProvider } from "./weather-provider";

export { PagasaWeatherProvider } from "./pagasa-weather.provider";
export type { DailyWeatherForecast, WeatherProvider } from "./weather-provider";
export { WeatherProviderError } from "./weather-provider";

let cachedProvider: WeatherProvider | null = null;

/**
 * Readiness deliberately has one disclosed source for now. If PAGASA is
 * unavailable, callers receive that state rather than a silent third-party
 * substitute that could change the meaning of the readiness message.
 */
export function getWeatherProvider(): WeatherProvider {
  if (!cachedProvider) cachedProvider = new PagasaWeatherProvider();
  return cachedProvider;
}

/** Test seam. */
export function resetWeatherProvider(): void {
  cachedProvider = null;
}
