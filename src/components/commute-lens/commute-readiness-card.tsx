"use client";
import {
  ArrowRightLeft,
  CircleAlert,
  Cloud,
  CloudRain,
  Footprints,
  Info,
  LoaderCircle,
  MapPinned,
  Sun,
} from "lucide-react";
import type { ReactNode } from "react";
import type { CommuteReadiness } from "@/application/assess-commute-readiness/use-case";
import { Eyebrow } from "@/components/ui/typography";
import { formatMinutes } from "./format";
export function CommuteReadinessCard({
  readiness,
  state,
}: {
  readiness: CommuteReadiness | null;
  state: "idle" | "loading" | "unavailable";
}) {
  if (state === "loading") return <LoadingCard />;
  if (!readiness || state === "unavailable") return <UnavailableCard />;

  const weatherVisual = classifyWeather(readiness);

  return (
    <section
      className="app-panel commute-readiness-weather relative isolate overflow-hidden p-5 sm:p-6 print:hidden"
      data-weather={weatherVisual}
    >
      <WeatherScene visual={weatherVisual} />
      <div className="relative z-[1]">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Eyebrow>Commute readiness · {readiness.travelDate}</Eyebrow>
            <h2 className="mt-2 font-headline text-2xl leading-none font-black tracking-[-0.03em] sm:text-3xl">
              {levelHeading(readiness.level)}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              {levelMessage(readiness)}
            </p>
          </div>
          <ReadinessBadge level={readiness.level} />
        </header>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <WeatherContext readiness={readiness} visual={weatherVisual} />
          <RouteFriction readiness={readiness} />
        </div>
        {/* No backdrop blur: this card is inside a scroll-revealed section, and a
            backdrop-filter under an animating ancestor repaints every frame. At 2px
            it was invisible anyway. */}
        <section className="mt-4 flex items-start gap-3 rounded-[0.9rem] bg-mint/60 p-4">
          <MapPinned className="mt-0.5 size-4 shrink-0 text-leaf" aria-hidden="true" />
          <div>
            <h3 className="text-[0.7rem] font-black tracking-[0.1em] uppercase">Hazard context</h3>
            <p className="mt-1 text-[0.78rem] leading-relaxed text-ink/70">
              {readiness.hazard.message}
            </p>
          </div>
        </section>
        <footer className="mt-4 flex items-start gap-2 border-t border-ink/10 pt-3 text-[0.68rem] leading-relaxed text-muted">
          <Info className="mt-0.5 size-3.5 shrink-0 text-flame" aria-hidden="true" />
          <span>
            Readiness describes forecast conditions and the selected route&apos;s observed details.
            It is not an arrival guarantee, a safety rating, or a flood prediction.
            {readiness.sources[0]
              ? ` Weather source: ${readiness.sources[0].name}, retrieved ${formatTimestamp(readiness.sources[0].retrievedAt)}.`
              : " Weather context is not currently available."}
          </span>
        </footer>
      </div>
    </section>
  );
}

type WeatherVisual = "rain" | "cloud" | "sun" | "heat" | "neutral";

function WeatherScene({ visual }: { visual: WeatherVisual }) {
  return (
    <div className="commute-weather-scene" data-weather={visual} aria-hidden="true">
      <span className="commute-weather-orb" />
      <span className="commute-weather-cloud commute-weather-cloud-a" />
      <span className="commute-weather-cloud commute-weather-cloud-b" />
      <span className="commute-weather-rain" />
      <span className="commute-weather-heat" />
    </div>
  );
}

function classifyWeather(readiness: CommuteReadiness): WeatherVisual {
  const weather = readiness.weather;
  if (weather.availability !== "available" || !weather.forecast) return "neutral";

  const forecast = weather.forecast;
  const rainfallDescription = forecast.rainfallDescription.toLowerCase();
  const cloudCover = forecast.cloudCover?.toLowerCase() ?? "";
  const explicitlyDry = /\b(?:no|none|zero)\b.*\brain/.test(rainfallDescription);

  if (forecast.rainfallMillimetres > 0 || !explicitlyDry) return "rain";
  if (/\b(?:overcast|cloudy|mostly cloudy)\b/.test(cloudCover)) return "cloud";
  if ((forecast.maximumTemperatureCelsius ?? 0) >= 35) return "heat";
  if (/\b(?:clear|sunny|fair|few clouds?|partly cloudy|scattered clouds?)\b/.test(cloudCover)) {
    return "sun";
  }
  return "neutral";
}

function weatherIcon(visual: WeatherVisual) {
  if (visual === "rain") return <CloudRain className="size-3.5 text-flame" aria-hidden="true" />;
  if (visual === "cloud") return <Cloud className="size-3.5 text-flame" aria-hidden="true" />;
  if (visual === "sun" || visual === "heat") {
    return <Sun className="size-3.5 text-flame" aria-hidden="true" />;
  }
  return <CloudRain className="size-3.5 text-flame" aria-hidden="true" />;
}

function WeatherContext({
  readiness,
  visual,
}: {
  readiness: CommuteReadiness;
  visual: WeatherVisual;
}) {
  const weather = readiness.weather;
  if (weather.availability !== "available" || !weather.forecast) {
    return (
      <section className="rounded-[0.9rem] border border-ink/10 p-4">
        <h3 className="flex items-center gap-2 text-[0.68rem] font-black tracking-[0.1em] uppercase">
          {weatherIcon(visual)} Weather context
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">{weather.message}</p>
      </section>
    );
  }
  const forecast = weather.forecast;
  return (
    <section className="rounded-[0.9rem] border border-ink/10 p-4">
      <h3 className="flex items-center gap-2 text-[0.68rem] font-black tracking-[0.1em] uppercase">
        {weatherIcon(visual)} PAGASA daily forecast
      </h3>
      <p className="mt-2 text-sm font-bold">{forecast.areaLabel}</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <ReadinessFact
          label="Rainfall"
          value={`${formatNumber(forecast.rainfallMillimetres)} mm`}
          detail={forecast.rainfallDescription}
        />
        <ReadinessFact
          label="Temperature"
          value={temperatureRange(
            forecast.minimumTemperatureCelsius,
            forecast.maximumTemperatureCelsius,
          )}
          detail={forecast.cloudCover ?? "Daily forecast"}
        />
      </dl>
    </section>
  );
}
function RouteFriction({ readiness }: { readiness: CommuteReadiness }) {
  if (!readiness.friction) {
    return (
      <section className="rounded-[0.9rem] border border-ink/10 p-4">
        <h3 className="flex items-center gap-2 text-[0.68rem] font-black tracking-[0.1em] uppercase">
          <Footprints className="size-3.5 text-flame" aria-hidden="true" /> Route friction
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          There is no office commute to assess for this schedule.
        </p>
      </section>
    );
  }
  const friction = readiness.friction;
  if (friction.routeDetail === "estimated") {
    return (
      <section className="rounded-[0.9rem] border border-ink/10 p-4">
        <h3 className="flex items-center gap-2 text-[0.68rem] font-black tracking-[0.1em] uppercase">
          <Footprints className="size-3.5 text-flame" aria-hidden="true" /> Route friction
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          This is a distance-based route estimate. Walking and transfer exposure could not be
          observed, so this is a limited readiness assessment.
        </p>
        <p className="numeric mt-3 text-[0.75rem] text-muted">
          Estimated one-way duration: {formatMinutes(friction.oneWayDurationMinutes)}
        </p>
      </section>
    );
  }
  return (
    <section className="rounded-[0.9rem] border border-ink/10 p-4">
      <h3 className="flex items-center gap-2 text-[0.68rem] font-black tracking-[0.1em] uppercase">
        <Footprints className="size-3.5 text-flame" aria-hidden="true" /> Route friction
      </h3>
      <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
        <ReadinessFact
          icon={<Footprints className="size-3.5" aria-hidden="true" />}
          label="Walking"
          value={formatMinutes(friction.walkingMinutes ?? 0)}
          detail={`${friction.walkingLegCount ?? 0} observed leg${friction.walkingLegCount === 1 ? "" : "s"}`}
        />
        <ReadinessFact
          icon={<ArrowRightLeft className="size-3.5" aria-hidden="true" />}
          label="Transfers"
          value={String(friction.transferCount ?? 0)}
          detail="between transit legs"
        />
        <ReadinessFact
          icon={<CircleAlert className="size-3.5" aria-hidden="true" />}
          label="Fare data"
          value={confidenceLabel(friction.fareConfidence)}
          detail={friction.routeDetail === "demo" ? "curated demo route" : "route source evidence"}
        />
      </dl>
    </section>
  );
}
function ReadinessFact({
  icon,
  label,
  value,
  detail,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[0.6rem] font-black tracking-[0.1em] text-muted uppercase">
        {icon && <span className="text-flame">{icon}</span>}
        {label}
      </dt>
      <dd className="numeric mt-1 font-headline text-lg leading-none font-black">{value}</dd>
      <dd className="mt-1 text-[0.68rem] leading-snug text-muted">{detail}</dd>
    </div>
  );
}
function ReadinessBadge({ level }: { level: CommuteReadiness["level"] }) {
  const className =
    level === "higher-friction"
      ? "bg-flame/12 text-flame"
      : level === "standard"
        ? "bg-leaf/12 text-leaf"
        : "bg-ink/8 text-ink/70";
  return (
    <span
      className={`rounded-full px-3 py-1.5 text-[0.65rem] font-black tracking-[0.08em] uppercase ${className}`}
    >
      {levelLabel(level)}
    </span>
  );
}
function levelHeading(level: CommuteReadiness["level"]): string {
  switch (level) {
    case "higher-friction":
      return "Higher-friction conditions";
    case "standard":
      return "Standard conditions";
    case "not-applicable":
      return "No commute to assess";
    default:
      return "Limited assessment";
  }
}
function levelLabel(level: CommuteReadiness["level"]): string {
  return level === "higher-friction"
    ? "Prepare extra"
    : level === "standard"
      ? "Route facts available"
      : level === "not-applicable"
        ? "Not applicable"
        : "Limited data";
}
function levelMessage(readiness: CommuteReadiness): string {
  if (readiness.level === "not-applicable") {
    return "This schedule has no office commute. Add an onsite scenario and resolve a route to check it.";
  }
  if (readiness.level === "limited") {
    return "Some route or weather detail is unavailable, so Commute Lens is showing only the evidence it can verify.";
  }
  if (readiness.level === "higher-friction") {
    return "Weather and route exposure may require more preparation for outdoor segments. Consider allowing more buffer time.";
  }
  return "Forecast context and route exposure are available for this commute. Conditions can still change.";
}
function temperatureRange(minimum: number | null, maximum: number | null): string {
  if (minimum === null && maximum === null) return "Unavailable";
  if (minimum === null) return `${formatNumber(maximum ?? 0)}°C high`;
  if (maximum === null) return `${formatNumber(minimum)}°C low`;
  return `${formatNumber(minimum)}–${formatNumber(maximum)}°C`;
}
function confidenceLabel(confidence: string): string {
  if (confidence === "unspecified") return "Unspecified";
  return `${confidence[0]?.toUpperCase()}${confidence.slice(1)}`;
}
function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-PH", { maximumFractionDigits: 1 }).format(value);
}
function formatTimestamp(value: string | undefined): string {
  if (!value) return "at an unspecified time";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}
function LoadingCard() {
  return (
    <section
      className="app-panel flex items-center gap-3 p-5 text-sm text-muted print:hidden"
      aria-live="polite"
    >
      <LoaderCircle className="size-4 motion-safe:animate-spin text-flame" aria-hidden="true" />
      Checking PAGASA weather context and route friction…
    </section>
  );
}
function UnavailableCard() {
  return (
    <section className="app-panel flex items-start gap-3 p-5 text-sm leading-relaxed text-muted print:hidden">
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-flame" aria-hidden="true" />
      <span>
        Commute readiness is temporarily unavailable. Your fare, time, and route analysis remain
        unchanged.
      </span>
    </section>
  );
}
