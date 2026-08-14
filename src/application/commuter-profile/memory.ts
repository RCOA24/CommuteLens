import { z } from "zod";
import { sanitizeFreeText } from "@/application/explain-analysis/facts";
import type { JobRealityAnalysis } from "@/domain/models";

/**
 * The commuter memory record formats.
 *
 * Two deliberate decisions live here.
 *
 * **Structured, not semantic.** A remembered profile prefills a form with exact
 * numbers, so it is stored as one machine-readable line behind a version marker
 * and read back by parsing, never by semantic retrieval. Vector search is the
 * right tool for "what did we discuss"; it is the wrong tool for "what is this
 * person's take-home assumption".
 *
 * **Coarse by construction.** Coordinates are rounded to three decimals (about
 * 100 m) and labels are truncated before they are ever written. The app's promise
 * is that it does not retain a precise home address, and a memory layer must not
 * quietly break that promise.
 */

export const PROFILE_MARKER = "COMMUTELENS_PROFILE_V1";
export const OFFER_MARKER = "COMMUTELENS_OFFER_V1";

const COORDINATE_DECIMALS = 3;
const MAX_LEDGER_ENTRIES = 12;

const coarseCoordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const commuterProfileSchema = z.object({
  version: z.literal(1),
  homeLabel: z.string().max(80).nullable(),
  homeCoordinate: coarseCoordinateSchema.nullable(),
  fareClass: z.enum(["regular", "student", "senior", "pwd"]).nullable(),
  workArrangement: z.enum(["onsite", "hybrid", "remote"]).nullable(),
  workingHoursPerDay: z.number().positive().max(24).nullable(),
  takeHomePercent: z.number().min(50).max(100).nullable(),
  /** The commute length this person says they can live with. Planning input only. */
  maxOneWayMinutes: z.number().positive().max(600).nullable(),
  updatedAt: z.string().min(1),
});

export type CommuterProfile = z.infer<typeof commuterProfileSchema>;

export const offerLedgerEntrySchema = z.object({
  version: z.literal(1),
  id: z.string().min(1).max(80),
  title: z.string().max(80),
  company: z.string().max(80),
  officeLabel: z.string().max(80),
  monthlySalary: z.number(),
  onsiteDaysPerWeek: z.number().int().min(0).max(7),
  incomeAfterCommute: z.number(),
  effectiveHourlyValue: z.number(),
  monthlyCommuteHours: z.number(),
  commuteBurdenPercentage: z.number(),
  analyzedAt: z.string().min(1),
});

export type OfferLedgerEntry = z.infer<typeof offerLedgerEntrySchema>;

/** A stored memory exactly as it will be shown back to the user. */
export interface CommuterMemoryRecord {
  id: string;
  content: string;
}

export function roundCoordinate(value: number): number {
  const factor = 10 ** COORDINATE_DECIMALS;
  return Math.round(value * factor) / factor;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Applies the coarseness and length limits before anything is persisted. */
export function normalizeProfile(profile: CommuterProfile): CommuterProfile {
  return {
    ...profile,
    homeLabel: profile.homeLabel === null ? null : sanitizeFreeText(profile.homeLabel),
    homeCoordinate:
      profile.homeCoordinate === null
        ? null
        : {
            latitude: roundCoordinate(profile.homeCoordinate.latitude),
            longitude: roundCoordinate(profile.homeCoordinate.longitude),
          },
  };
}

export function serializeProfile(profile: CommuterProfile): string {
  return `${PROFILE_MARKER} ${JSON.stringify(normalizeProfile(profile))}`;
}

export function serializeOffer(entry: OfferLedgerEntry): string {
  return `${OFFER_MARKER} ${JSON.stringify(entry)}`;
}

function parseMarked<TSchema extends z.ZodType>(
  content: string,
  marker: string,
  schema: TSchema,
): z.infer<TSchema> | null {
  if (!content.startsWith(marker)) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(content.slice(marker.length).trim()));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function isProfileRecord(content: string): boolean {
  return content.startsWith(PROFILE_MARKER);
}

/**
 * The offer id held in a stored record, or null if this is not an offer record.
 *
 * Deliberately more lenient than `selectOffers`: it reads the id without
 * validating the rest of the entry. An entry written by a different version of
 * this app may fail validation, and such a record is already invisible because
 * the shortlist drops it — if deletion also required a valid entry, that record
 * would be permanently unremovable.
 *
 * Displaying an unvalidated entry would be wrong. Deleting one must stay possible.
 */
export function offerIdFromRecord(content: string): string | null {
  if (!content.startsWith(OFFER_MARKER)) return null;
  try {
    const payload: unknown = JSON.parse(content.slice(OFFER_MARKER.length).trim());
    if (payload === null || typeof payload !== "object") return null;
    const id = (payload as { id?: unknown }).id;
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

/**
 * Latest write wins. Stale profile records are tidied up on the next write, so a
 * transient cleanup failure degrades into a harmless duplicate rather than a
 * wrong answer.
 */
export function selectProfile(records: readonly CommuterMemoryRecord[]): CommuterProfile | null {
  const profiles = records
    .map((record) => parseMarked(record.content, PROFILE_MARKER, commuterProfileSchema))
    .filter((profile): profile is CommuterProfile => profile !== null);
  if (profiles.length === 0) return null;

  return profiles.reduce((latest, candidate) =>
    Date.parse(candidate.updatedAt) > Date.parse(latest.updatedAt) ? candidate : latest,
  );
}

export function selectOffers(records: readonly CommuterMemoryRecord[]): OfferLedgerEntry[] {
  const offers = records
    .map((record) => parseMarked(record.content, OFFER_MARKER, offerLedgerEntrySchema))
    .filter((entry): entry is OfferLedgerEntry => entry !== null);

  const byId = new Map<string, OfferLedgerEntry>();
  for (const entry of offers) {
    const existing = byId.get(entry.id);
    if (!existing || Date.parse(entry.analyzedAt) > Date.parse(existing.analyzedAt)) {
      byId.set(entry.id, entry);
    }
  }

  return [...byId.values()]
    .sort((left, right) => Date.parse(right.analyzedAt) - Date.parse(left.analyzedAt))
    .slice(0, MAX_LEDGER_ENTRIES);
}

/**
 * Builds a ledger entry from a completed analysis.
 *
 * Every figure is copied from the domain result. Nothing is recomputed here, so a
 * remembered shortlist can never disagree with the receipt it came from.
 */
export function buildOfferLedgerEntry(
  analysis: JobRealityAnalysis,
  analyzedAt = new Date().toISOString(),
): OfferLedgerEntry {
  return {
    version: 1,
    id: analysis.jobOffer.id.slice(0, 80),
    title: sanitizeFreeText(analysis.jobOffer.title),
    company: sanitizeFreeText(analysis.jobOffer.company),
    officeLabel: sanitizeFreeText(analysis.jobOffer.officeLocation.label),
    monthlySalary: round(analysis.jobOffer.monthlySalary, 2),
    onsiteDaysPerWeek: analysis.jobOffer.onsiteDaysPerWeek,
    incomeAfterCommute: round(analysis.incomeAfterCommute, 2),
    effectiveHourlyValue: round(analysis.effectiveHourlyValue, 2),
    monthlyCommuteHours: round(analysis.monthlyCommuteHours, 1),
    commuteBurdenPercentage: round(analysis.commuteBurdenPercentage, 1),
    analyzedAt,
  };
}
