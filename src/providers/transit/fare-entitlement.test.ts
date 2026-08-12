import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MANDATED_DISCOUNT_RATE } from "@/domain/fare";
import { DEMO_OFFICES, DEMO_ORIGINS } from "@/data/demo";
import { commuteRouteSchema } from "@/shared/validation/domain-schemas";
import { getTransitProvider, resetTransitProvider } from "./index";

/**
 * The statutory discount is applied in exactly one place: a wrapper above every
 * transit provider. These tests pin that down, because the obvious alternative —
 * discounting inside each provider *and* in the wrapper — silently halves fares
 * again and is invisible without a comparison.
 */
describe("fare entitlement wrapper", () => {
  const previous = process.env.TRANSIT_PROVIDER;

  beforeEach(() => {
    process.env.TRANSIT_PROVIDER = "demo";
    resetTransitProvider();
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.TRANSIT_PROVIDER;
    else process.env.TRANSIT_PROVIDER = previous;
    resetTransitProvider();
  });

  const corridor = { origin: DEMO_ORIGINS.alabang, destination: DEMO_OFFICES.bgc };

  async function fareFor(discountClass?: "regular" | "student" | "senior" | "pwd") {
    const result = await getTransitProvider().findRoutes({ ...corridor, discountClass });
    expect(result.status).toBe("success");
    if (result.status !== "success") throw new Error("corridor should route");
    return result.routes[0];
  }

  it("charges full fare when no entitlement is given", async () => {
    const omitted = await fareFor(undefined);
    const explicit = await fareFor("regular");
    expect(omitted.oneWayFare).toBe(explicit.oneWayFare);
  });

  it("applies the mandated discount exactly once", async () => {
    const regular = await fareFor("regular");
    const student = await fareFor("student");

    // Discountable legs only, so the total drops by at most the mandated rate
    // and by strictly more than half of it. Applying it twice would land near
    // 0.64 of the regular fare and fail the lower bound.
    const ratio = student.oneWayFare / regular.oneWayFare;
    expect(ratio).toBeLessThan(1);
    expect(ratio).toBeGreaterThanOrEqual(1 - MANDATED_DISCOUNT_RATE - 0.01);
  });

  it("treats the three entitlements identically", async () => {
    const [student, senior, pwd] = await Promise.all([
      fareFor("student"),
      fareFor("senior"),
      fareFor("pwd"),
    ]);
    expect(senior.oneWayFare).toBe(student.oneWayFare);
    expect(pwd.oneWayFare).toBe(student.oneWayFare);
  });

  it("returns routes that still satisfy their own invariants", async () => {
    const student = await fareFor("student");
    expect(commuteRouteSchema.safeParse(student).success).toBe(true);
  });
});
