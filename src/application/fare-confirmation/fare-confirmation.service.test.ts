import { describe, expect, it } from "vitest";
import { DEMO_ROUTES } from "@/data/demo";
import {
  FareConfirmationService,
  FareConfirmationValidationError,
  MINIMUM_CONFIRMATION_REPORTS,
} from "./fare-confirmation.service";
import { InMemoryFareConfirmationRepository } from "@/providers/fare-confirmation/in-memory-fare-confirmation.repository";

const regularRailRoute = DEMO_ROUTES[0]!;
const routeWithWalkingLeg = DEMO_ROUTES[1]!;

function createService() {
  let now = new Date("2026-08-12T12:00:00.000Z");
  return {
    service: new FareConfirmationService({
      repository: new InMemoryFareConfirmationRepository(),
      legKeyFactory: {
        create: ({ segmentIndex, discountClass }) => `opaque:${segmentIndex}:${discountClass}`,
      },
      now: () => now,
    }),
    advance(minutes: number) {
      now = new Date(now.getTime() + minutes * 60_000);
    },
  };
}

describe("FareConfirmationService", () => {
  it("keeps reports as an aggregate overlay until a median has a quorum", () => {
    const { service, advance } = createService();
    const base = { route: regularRailRoute, discountClass: "regular" as const, segmentIndex: 0 };

    for (const observedFare of [28, 29, 30, 31]) {
      const result = service.confirm({ ...base, observedFare });
      expect(result.status).toBe("collecting");
      expect(result.typicalFare).toBeNull();
      advance(1);
    }

    const confirmed = service.confirm({ ...base, observedFare: 30 });
    expect(confirmed.reportCount).toBe(MINIMUM_CONFIRMATION_REPORTS);
    expect(confirmed.status).toBe("community-submitted");
    expect(confirmed.typicalFare).toBe(30);
    expect(confirmed.reportedFareRange).toEqual({ low: 28, high: 31 });
  });

  it("rejects walking legs, impossible fare bands, and reports far outside existing consensus", () => {
    const { service } = createService();
    expect(() =>
      service.confirm({
        route: routeWithWalkingLeg,
        discountClass: "regular",
        segmentIndex: 1,
        observedFare: 20,
      }),
    ).toThrow(FareConfirmationValidationError);

    expect(() =>
      service.confirm({
        route: regularRailRoute,
        discountClass: "regular",
        segmentIndex: 0,
        observedFare: 2,
      }),
    ).toThrow(/plausible/i);

    for (const observedFare of [28, 28, 29]) {
      service.confirm({
        route: regularRailRoute,
        discountClass: "regular",
        segmentIndex: 0,
        observedFare,
      });
    }
    expect(() =>
      service.confirm({
        route: regularRailRoute,
        discountClass: "regular",
        segmentIndex: 0,
        observedFare: 400,
      }),
    ).toThrow(/outside/i);
  });

  it("never returns route labels or coordinates in confirmation aggregates", () => {
    const { service } = createService();
    const summary = service.confirm({
      route: regularRailRoute,
      discountClass: "regular",
      segmentIndex: 0,
      observedFare: 28,
    });
    const serialized = JSON.stringify(summary);

    expect(serialized).not.toContain(regularRailRoute.id);
    expect(serialized).not.toContain(regularRailRoute.segments[0]!.origin.label);
    expect(serialized).not.toContain(
      String(regularRailRoute.segments[0]!.origin.coordinate.latitude),
    );
    expect(summary.segmentKey).toMatch(/^opaque:/);
  });

  it("does not mix reports from a mismatched entitlement route", () => {
    const { service } = createService();
    const studentRoute = {
      ...regularRailRoute,
      sources: [
        ...regularRailRoute.sources,
        {
          type: "official" as const,
          name: "Fare entitlement: Student fare — test",
          confidence: "high" as const,
        },
      ],
    };

    expect(() => service.lookup({ route: studentRoute, discountClass: "regular" })).toThrow(
      /fare class changed/i,
    );
  });
});
