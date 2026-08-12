import { FareConfirmationService } from "@/application/fare-confirmation/fare-confirmation.service";
import { InMemoryFareConfirmationRepository } from "./in-memory-fare-confirmation.repository";
import { HmacFareLegKeyFactory } from "./opaque-leg-key";

let service: FareConfirmationService | null = null;

/** Session-only aggregate confirmation service for the current server process. */
export function getFareConfirmationService(): FareConfirmationService {
  service ??= new FareConfirmationService({
    repository: new InMemoryFareConfirmationRepository(),
    legKeyFactory: new HmacFareLegKeyFactory(),
  });
  return service;
}
