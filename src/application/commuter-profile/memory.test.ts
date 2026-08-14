import { describe, expect, it } from "vitest";
import {
  OFFER_MARKER,
  PROFILE_MARKER,
  buildOfferLedgerEntry,
  selectOffers,
  selectProfile,
  serializeOffer,
  serializeProfile,
  type CommuterProfile,
  type OfferLedgerEntry,
} from "./memory";
import { isValidHandle } from "./store";

const PROFILE: CommuterProfile = {
  version: 1,
  homeLabel: "Guiguinto, Bulacan",
  homeCoordinate: { latitude: 14.8259371, longitude: 120.8817462 },
  fareClass: "student",
  workArrangement: "hybrid",
  workingHoursPerDay: 8,
  takeHomePercent: 90,
  maxOneWayMinutes: null,
  updatedAt: "2026-08-01T00:00:00.000Z",
};

const OFFER: OfferLedgerEntry = {
  version: 1,
  id: "job-1",
  title: "Developer",
  company: "Example",
  officeLabel: "BGC, Taguig",
  monthlySalary: 45_000,
  onsiteDaysPerWeek: 3,
  incomeAfterCommute: 38_000,
  effectiveHourlyValue: 210,
  monthlyCommuteHours: 26,
  commuteBurdenPercentage: 7.2,
  analyzedAt: "2026-08-01T00:00:00.000Z",
};

describe("commuter memory records", () => {
  it("rounds a stored coordinate to roughly 100 m before it is persisted", () => {
    const stored = serializeProfile(PROFILE);
    const parsed = selectProfile([{ id: "1", content: stored }]);

    expect(parsed?.homeCoordinate).toEqual({ latitude: 14.826, longitude: 120.882 });
    expect(stored).not.toContain("14.8259371");
  });

  it("writes behind a version marker so records are read by parsing, not by search", () => {
    expect(serializeProfile(PROFILE).startsWith(`${PROFILE_MARKER} `)).toBe(true);
    expect(serializeOffer(OFFER).startsWith(`${OFFER_MARKER} `)).toBe(true);
  });

  it("ignores unrelated memories instead of guessing at them", () => {
    const records = [
      { id: "1", content: "User prefers Python over JavaScript" },
      { id: "2", content: `${PROFILE_MARKER} not json at all` },
    ];

    expect(selectProfile(records)).toBeNull();
    expect(selectOffers(records)).toEqual([]);
  });

  it("resolves the newest profile when a stale duplicate survived a cleanup failure", () => {
    const older = serializeProfile({ ...PROFILE, takeHomePercent: 80 });
    const newer = serializeProfile({
      ...PROFILE,
      takeHomePercent: 95,
      updatedAt: "2026-08-14T00:00:00.000Z",
    });

    const profile = selectProfile([
      { id: "1", content: older },
      { id: "2", content: newer },
    ]);

    expect(profile?.takeHomePercent).toBe(95);
  });

  it("keeps one entry per offer id, newest first", () => {
    const first = serializeOffer(OFFER);
    const reanalyzed = serializeOffer({
      ...OFFER,
      incomeAfterCommute: 41_000,
      analyzedAt: "2026-08-14T00:00:00.000Z",
    });
    const other = serializeOffer({
      ...OFFER,
      id: "job-2",
      analyzedAt: "2026-08-10T00:00:00.000Z",
    });

    const offers = selectOffers([
      { id: "1", content: first },
      { id: "2", content: reanalyzed },
      { id: "3", content: other },
    ]);

    expect(offers.map((offer) => offer.id)).toEqual(["job-1", "job-2"]);
    expect(offers[0]?.incomeAfterCommute).toBe(41_000);
  });

  it("copies ledger figures from the analysis instead of recomputing them", () => {
    const entry = buildOfferLedgerEntry(
      {
        origin: { label: "Home", coordinate: { latitude: 14.6, longitude: 121 } },
        jobOffer: {
          id: "job-9",
          title: "Developer",
          company: "Example",
          monthlySalary: 45_000,
          officeLocation: { label: "Office", coordinate: { latitude: 14.55, longitude: 121.05 } },
          workArrangement: "hybrid",
          onsiteDaysPerWeek: 3,
          workingHoursPerDay: 8,
          estimatedTakeHomeRate: 0.9,
        },
        fareDiscountClass: "regular",
        commute: {
          route: null,
          segments: [],
          oneWayMinutes: 0,
          officeDaysPerMonth: 13,
          monthlyFare: 1_000,
        },
        estimatedTakeHomePay: 40_500,
        incomeAfterCommute: 39_500,
        commuteBurdenPercentage: 2.4691,
        monthlyCommuteHours: 26.05,
        monthlyWorkHours: 173.3,
        effectiveHourlyValue: 198.246,
        sources: [],
      } as unknown as Parameters<typeof buildOfferLedgerEntry>[0],
      "2026-08-14T00:00:00.000Z",
    );

    expect(entry.incomeAfterCommute).toBe(39_500);
    expect(entry.effectiveHourlyValue).toBe(198.25);
    expect(entry.monthlyCommuteHours).toBe(26.1);
    expect(entry.commuteBurdenPercentage).toBe(2.5);
  });

  it("only accepts UUID-shaped handles, so a handle cannot reshape a provider URL", () => {
    expect(isValidHandle("3f2504e0-4f89-11d3-9a0c-0305e82c3301")).toBe(true);
    expect(isValidHandle("../../assistants")).toBe(false);
    expect(isValidHandle("")).toBe(false);
  });
});
