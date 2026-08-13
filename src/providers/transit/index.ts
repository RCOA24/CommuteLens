import { BusMapsTransitProvider } from "./busmaps-transit.provider";
import { EstimatedTransitProvider } from "./estimated-transit.provider";
import { MockTransitProvider } from "./mock-transit.provider";
import { StaticGtfsTransitProvider } from "./static-gtfs-transit.provider";
import type { TransitProvider } from "./transit-provider";

export { BusMapsTransitProvider } from "./busmaps-transit.provider";
export { EstimatedTransitProvider } from "./estimated-transit.provider";
export { MobilityDatabaseCatalogProvider } from "./mobility-database-catalog.provider";
export { MockTransitProvider } from "./mock-transit.provider";
export { StaticGtfsTransitProvider } from "./static-gtfs-transit.provider";
export type { TransitProvider } from "./transit-provider";

let cachedProvider: TransitProvider | null = null;

function composeProviders(
  providers: TransitProvider[],
  estimated: EstimatedTransitProvider,
): TransitProvider {
  return {
    async findRoutes(request) {
      let foundCoverageGap = false;
      let unavailable: {
        status: "unavailable";
        routes: [];
        message: string;
      } | null = null;

      for (const provider of providers) {
        const result = await provider.findRoutes(request);
        if (result.status === "success") return result;
        if (result.status === "unsupported") foundCoverageGap = true;
        else unavailable = { status: "unavailable", routes: [], message: result.message };
      }

      // A provider-confirmed coverage gap may be estimated. If every configured
      // source failed operationally, keep that outage explicit instead.
      if (foundCoverageGap) return estimated.findRoutes(request);
      return (
        unavailable ?? {
          status: "unavailable",
          routes: [],
          message: "No transit data provider is configured.",
        }
      );
    },
  };
}

/**
 * Provider order:
 * 1. BusMaps live routing when configured.
 * 2. DOTC/Sakay open GTFS route patterns for independent coverage.
 * 3. The transparent distance estimate only after a genuine coverage gap.
 *
 * The static feed is archival and labels every result accordingly. It improves
 * stop/connection detail without pretending the old timetable is live.
 */
export function getTransitProvider(): TransitProvider {
  if (cachedProvider) return cachedProvider;

  const selected = process.env.TRANSIT_PROVIDER?.trim().toLowerCase();
  if (selected === "demo" || (process.env.NODE_ENV === "test" && !selected)) {
    return (cachedProvider = new MockTransitProvider());
  }

  const estimated = new EstimatedTransitProvider();
  const openData = new StaticGtfsTransitProvider();
  if (selected === "gtfs") {
    return (cachedProvider = composeProviders([openData], estimated));
  }

  const providers: TransitProvider[] = [];
  if (process.env.BUSMAPS_API_KEY?.trim() || selected === "busmaps") {
    providers.push(new BusMapsTransitProvider());
  }
  if (process.env.OPEN_GTFS_ENABLED?.trim().toLowerCase() !== "false") {
    providers.push(openData);
  }

  return (cachedProvider = composeProviders(providers, estimated));
}

export function resetTransitProvider(): void {
  cachedProvider = null;
}
