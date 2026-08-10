import type { CommuteRoute, Location, TransportMode } from "@/domain/models";

export interface TransitRouteRequest {
  origin: Location;
  destination: Location;
  preferredModes?: TransportMode[];
}

export type TransitRouteResult =
  | { status: "success"; routes: CommuteRoute[] }
  | { status: "unsupported" | "unavailable"; routes: []; message: string };

export interface TransitProvider {
  findRoutes(request: TransitRouteRequest): Promise<TransitRouteResult>;
}
