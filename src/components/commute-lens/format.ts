import type { TransportMode, WorkArrangement } from "@/domain/models";

/**
 * Presentation-only formatting. Nothing here derives a business metric — every
 * number arriving in this module has already been produced by the domain layer.
 */

const pesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const compactPesoFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  notation: "compact",
  maximumFractionDigits: 1,
});

const plainNumberFormatter = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });

export function formatPeso(value: number): string {
  return pesoFormatter.format(value);
}

/** Signed peso, for deltas where the direction is the point. */
export function formatPesoDelta(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) return formatPeso(0);
  return `${rounded > 0 ? "+" : "−"}${pesoFormatter.format(Math.abs(rounded))}`;
}

export function formatCompactPeso(value: number): string {
  return compactPesoFormatter.format(value);
}

export function formatNumber(value: number): string {
  return plainNumberFormatter.format(value);
}

export function formatHours(value: number): string {
  return `${value.toFixed(1)} hrs`;
}

export function formatHoursDelta(value: number): string {
  if (Math.abs(value) < 0.05) return "0 hrs";
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(1)} hrs`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatMinutes(value: number): string {
  const minutes = Math.round(value);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/** Trims a geocoded label down to something that fits a headline. */
export function shortPlace(label: string): string {
  return label.split(",")[0].replace(" Center", "").trim();
}

/** The remainder of a geocoded label, used as quiet secondary detail. */
export function placeContext(label: string): string {
  return label.split(",").slice(1).join(",").trim();
}

export function modeLabel(mode: TransportMode): string {
  switch (mode) {
    case "rail":
      return "Train";
    case "walk":
      return "Walk";
    case "uv-express":
      return "UV Express";
    case "p2p":
      return "P2P bus";
    case "other":
      // The provider could not identify the vehicle. Say that, rather than
      // guessing a mode the fare and the receipt would then repeat.
      return "Mixed transport";
    default:
      return mode.charAt(0).toUpperCase() + mode.slice(1);
  }
}

export function arrangementLabel(arrangement: WorkArrangement): string {
  switch (arrangement) {
    case "remote":
      return "Remote";
    case "onsite":
      return "Onsite";
    default:
      return "Hybrid";
  }
}

/** How the schedule reads once a day count is known. */
export function scheduleLabel(onsiteDaysPerWeek: number): string {
  if (onsiteDaysPerWeek === 0) return "Remote · no office days";
  if (onsiteDaysPerWeek === 5) return "Onsite · 5 days a week";
  return `Hybrid · ${onsiteDaysPerWeek} ${onsiteDaysPerWeek === 1 ? "day" : "days"} a week`;
}

export function dayWord(count: number): string {
  return count === 1 ? "day" : "days";
}

export function transferLabel(transfers: number): string {
  if (transfers === 0) return "No transfers";
  return `${transfers} transfer${transfers === 1 ? "" : "s"}`;
}

/** Four decimals is roughly 11 m — precise enough to look deliberate, honest enough to be true. */
export function formatCoordinate(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}

/**
 * Presentation bands for commute burden. These are labelling thresholds, not a
 * calculation: the percentage itself is produced by
 * `calculateCommuteBurden` in the domain layer. Thresholds match the values the
 * app has always shown so a saved screenshot still reads the same.
 */
export const BURDEN_BANDS = [
  { label: "Very low", max: 3 },
  { label: "Low", max: 7 },
  { label: "Moderate", max: 12 },
  { label: "High", max: Infinity },
] as const;

export function burdenBand(percentage: number): { label: string; index: number } {
  const index = BURDEN_BANDS.findIndex((band) => percentage < band.max);
  const resolved = index === -1 ? BURDEN_BANDS.length - 1 : index;
  return { label: BURDEN_BANDS[resolved].label, index: resolved };
}
