import { DEMO_ROUTES } from "@/data/demo-routes";
import type { TransitProvider, TransitRouteRequest, TransitRouteResult } from "./transit-provider";

const COORDINATE_TOLERANCE = 0.01;

function isNearby(left: number, right: number): boolean {
  return Math.abs(left - right) <= COORDINATE_TOLERANCE;
}

export class MockTransitProvider implements TransitProvider {
  async findRoutes(request: TransitRouteRequest): Promise<TransitRouteResult> {
    const route = DEMO_ROUTES.find((candidate) => {
      const origin = candidate.segments[0]?.origin.coordinate;
      const destination = candidate.segments.at(-1)?.destination.coordinate;
      return origin && destination
        && isNearby(origin.latitude, request.origin.coordinate.latitude)
        && isNearby(origin.longitude, request.origin.coordinate.longitude)
        && isNearby(destination.latitude, request.destination.coordinate.latitude)
        && isNearby(destination.longitude, request.destination.coordinate.longitude);
    });

    return route
      ? { status: "success", routes: [route] }
      : { status: "unsupported", routes: [], message: "No supported demo transit route is available for these locations." };
  }
}
