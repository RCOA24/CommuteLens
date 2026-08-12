import { applyFareDiscount, estimateRoadDistanceKm, priceLeg } from "@/domain/fare";
import type { CommuteRoute, DataSource } from "@/domain/models";
import type { TransitProvider, TransitRouteRequest, TransitRouteResult } from "./transit-provider";

const ROUTING_SOURCE: DataSource = {
  type: "estimated",
  name: "Commute Lens distance-based fallback (no itinerary available)",
  confidence: "low",
};

/**
 * A deliberately transparent fallback for corridors with no published live
 * transit route. It is not a substitute for a GTFS itinerary: duration and
 * fare are both estimates and must remain labelled as such in the UI/receipt.
 *
 * The leg is reported as `other` rather than as `bus`, because we genuinely do
 * not know which vehicle would serve the corridor. Naming a mode we cannot
 * observe would be a small lie that the fare and the receipt would then repeat.
 */
export class EstimatedTransitProvider implements TransitProvider {
  async findRoutes(request: TransitRouteRequest): Promise<TransitRouteResult> {
    const roadDistanceKm = estimateRoadDistanceKm(
      request.origin.coordinate,
      request.destination.coordinate,
    );
    if (roadDistanceKm < 0.05) {
      return {
        status: "unsupported",
        routes: [],
        message: "Choose two different locations for the commute.",
      };
    }

    // A conservative city-traffic model: 18 km/h average over the estimated
    // road distance, plus 12 minutes for access, waiting, and transfer friction.
    const minutes = Math.max(12, Math.round((roadDistanceKm / 18) * 60 + 12));

    // Fare comes from the shared fare matrix so the fallback and the live path
    // can never disagree about what a kilometre costs.
    const priced = priceLeg({
      mode: "other",
      from: request.origin.coordinate,
      to: request.destination.coordinate,
    });
    const fareSource = priced.source ?? ROUTING_SOURCE;

    const route: CommuteRoute = {
      id: `estimated-${request.origin.coordinate.latitude.toFixed(3)}-${request.destination.coordinate.latitude.toFixed(3)}`,
      segments: [
        {
          mode: "other",
          origin: request.origin,
          destination: request.destination,
          estimatedFare: priced.fare,
          estimatedDurationMinutes: minutes,
          source: fareSource,
        },
      ],
      oneWayFare: priced.fare,
      oneWayDurationMinutes: minutes,
      transfers: 0,
      reliability: "low",
      sources: [ROUTING_SOURCE, fareSource].filter(
        (source, index, all) => all.findIndex((other) => other.name === source.name) === index,
      ),
    };
    // Part of the provider contract, applied once to the fully priced route.
    return {
      status: "success",
      routes: [applyFareDiscount(route, request.discountClass ?? "regular")],
    };
  }
}
