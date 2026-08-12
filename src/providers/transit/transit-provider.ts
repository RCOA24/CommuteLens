import type { FareDiscountClass } from "@/domain/fare";
import type { CommuteRoute, Location, TransportMode } from "@/domain/models";

export interface TransitRouteRequest {
  origin: Location;
  destination: Location;
  preferredModes?: TransportMode[];
  /**
   * Statutory fare entitlement of the passenger. Applied as a route-level
   * transform after the provider prices the legs, so it works identically for
   * live, estimated, and curated routes.
   */
  discountClass?: FareDiscountClass;
}

export type TransitRouteResult =
  | { status: "success"; routes: CommuteRoute[] }
  | { status: "unsupported" | "unavailable"; routes: []; message: string };

export interface TransitProvider {
  findRoutes(request: TransitRouteRequest): Promise<TransitRouteResult>;
}
