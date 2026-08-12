import { z } from "zod";
import type { Location } from "@/domain/models";
import { TtlCache } from "@/shared/cache/ttl-cache";
import {
  type DailyWeatherForecast,
  type WeatherProvider,
  WeatherProviderError,
} from "./weather-provider";
const DEFAULT_BASE_URL = "https://tenday.pagasa.dost.gov.ph";
const REQUEST_TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 30 * 60 * 1_000;
const METRO_MANILA_MUNICIPALITIES = [
  "Caloocan",
  "Las Piñas",
  "Makati",
  "Malabon",
  "Mandaluyong",
  "Manila",
  "Marikina",
  "Muntinlupa",
  "Navotas",
  "Parañaque",
  "Pasay",
  "Pasig",
  "Pateros",
  "Quezon City",
  "San Juan",
  "Taguig",
  "Valenzuela",
] as const;
const forecastSchema = z.object({
  municity: z.string().trim().min(1),
  province: z.string().trim().min(1),
  forecast: z.object({
    rainfall: z.object({ total: z.number().finite(), desc: z.string().trim().min(1) }),
    cloud_cover: z.string().trim().min(1).nullable().optional(),
    temperature: z
      .object({
        min: z.number().finite().nullable().optional(),
        max: z.number().finite().nullable().optional(),
      })
      .nullable()
      .optional(),
    humidity: z.number().finite().nullable().optional(),
    wind: z
      .object({
        speed: z.number().finite().nullable().optional(),
        direction: z.string().trim().min(1).nullable().optional(),
      })
      .nullable()
      .optional(),
  }),
});
type PagasaArea = { municipality: string; province: string };
/**
 * PAGASA's TenDay API is municipality-level, so this provider deliberately
 * exposes daily area context—not an address-level or minute-by-minute claim.
 */
export class PagasaWeatherProvider implements WeatherProvider {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly cache: TtlCache<DailyWeatherForecast>;
  constructor(
    options: {
      baseUrl?: string;
      fetchImpl?: typeof fetch;
      cacheTtlMs?: number;
    } = {},
  ) {
    this.baseUrl = (
      options.baseUrl ??
      process.env.PAGASA_TENDAY_API_URL ??
      DEFAULT_BASE_URL
    ).replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.cache = new TtlCache(options.cacheTtlMs ?? CACHE_TTL_MS);
  }
  async getDailyForecast(input: {
    location: Location;
    date: string;
  }): Promise<DailyWeatherForecast> {
    const area = resolvePagasaArea(input.location);
    if (!area) {
      throw new WeatherProviderError(
        "PAGASA forecast area could not be identified from the selected destination.",
      );
    }
    const cacheKey = `${area.municipality.toLowerCase()}|${area.province.toLowerCase()}|${input.date}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    const url = new URL("/dateInternal", this.baseUrl);
    url.searchParams.set("municity", area.municipality);
    url.searchParams.set("province", area.province);
    url.searchParams.set("date", input.date);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new WeatherProviderError("PAGASA forecast data is temporarily unavailable.");
      }
      const parsed = forecastSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new WeatherProviderError("PAGASA returned an unexpected forecast response.");
      }
      const forecast: DailyWeatherForecast = {
        areaLabel: `${parsed.data.municity}, ${parsed.data.province}`,
        municipality: parsed.data.municity,
        province: parsed.data.province,
        date: input.date,
        rainfallMillimetres: parsed.data.forecast.rainfall.total,
        rainfallDescription: parsed.data.forecast.rainfall.desc,
        cloudCover: parsed.data.forecast.cloud_cover ?? null,
        minimumTemperatureCelsius: parsed.data.forecast.temperature?.min ?? null,
        maximumTemperatureCelsius: parsed.data.forecast.temperature?.max ?? null,
        humidityPercent: parsed.data.forecast.humidity ?? null,
        windSpeedMetresPerSecond: parsed.data.forecast.wind?.speed ?? null,
        windDirection: parsed.data.forecast.wind?.direction ?? null,
        source: {
          type: "official",
          name: "PAGASA TenDay Weather Forecast",
          sourceUrl: "https://tenday.pagasa.dost.gov.ph/",
          retrievedAt: new Date().toISOString(),
          effectiveDate: input.date,
          confidence: "medium",
        },
      };
      this.cache.set(cacheKey, forecast);
      return forecast;
    } catch (error) {
      if (error instanceof WeatherProviderError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new WeatherProviderError("PAGASA forecast request timed out.");
      }
      throw new WeatherProviderError("PAGASA forecast data could not be reached.");
    } finally {
      clearTimeout(timeout);
    }
  }
}
/**
 * Converts the label already chosen by the user into PAGASA's municipality and
 * province parameters. Metro Manila has no province in many geocoder labels,
 * so its city list is resolved before the generic comma-separated fallback.
 */
export function resolvePagasaArea(location: Location): PagasaArea | null {
  const normalized = location.label.toLocaleLowerCase("en-US");
  const metroMunicipality = METRO_MANILA_MUNICIPALITIES.find((municipality) =>
    normalized.includes(municipality.toLocaleLowerCase("en-US")),
  );
  if (metroMunicipality) return { municipality: metroMunicipality, province: "Metro Manila" };
  const parts = location.label
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !/^philippines$/i.test(part));
  if (parts.length < 2) return null;
  const municipality = parts.at(-2);
  const province = parts.at(-1);
  return municipality && province ? { municipality, province } : null;
}
