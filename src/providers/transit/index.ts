import { BusMapsTransitProvider } from "./busmaps-transit.provider";
import { EstimatedTransitProvider } from "./estimated-transit.provider";
import { MockTransitProvider } from "./mock-transit.provider";
import type { TransitProvider } from "./transit-provider";
export { BusMapsTransitProvider } from "./busmaps-transit.provider";
export { EstimatedTransitProvider } from "./estimated-transit.provider";
export { MobilityDatabaseCatalogProvider } from "./mobility-database-catalog.provider";
export { MockTransitProvider } from "./mock-transit.provider";
export type { TransitProvider } from "./transit-provider";
let cachedProvider: TransitProvider | null = null;

/**
 * Uses BusMaps when configured, with a transparent estimate for coverage gaps.
 *
 * Note on fare entitlements: honouring `request.discountClass` is part of the
 * `TransitProvider` contract, so each provider applies it to the routes it
 * produces. It deliberately does *not* happen in this composition. A wrapper
 * here would leave any caller that builds a provider directly — every unit test,
 * for one — silently quoting full fare while the analysis claimed a discount had
 * been applied.
 */
export function getTransitProvider(): TransitProvider {
  if (cachedProvider) return cachedProvider;
  const demo = new MockTransitProvider();
  if (process.env.TRANSIT_PROVIDER === "demo" || !process.env.BUSMAPS_API_KEY?.trim())
    return (cachedProvider = demo);
  const live = new BusMapsTransitProvider();
  const estimated = new EstimatedTransitProvider();
  cachedProvider = {
    async findRoutes(request) {
      const result = await live.findRoutes(request);
      if (result.status === "success") return result;
      // Coverage gaps may be estimated; authentication, quota and outages must
      // remain explicit so an infrastructure fault never masquerades as data.
      return result.status === "unsupported" ? estimated.findRoutes(request) : result;
    },
  };
  return cachedProvider;
}
export function resetTransitProvider(): void {
  cachedProvider = null;
}
