import { createHmac, randomBytes } from "node:crypto";
import type { FareLegKeyFactory } from "@/application/fare-confirmation/fare-confirmation.service";

/**
 * A per-process fallback keeps the local prototype private even when no
 * deployment secret is configured. It intentionally rotates on restart,
 * matching the session-only in-memory repository.
 */
const fallbackSecret = randomBytes(32).toString("base64url");

function coarseCell(latitude: number, longitude: number): string {
  // Coordinates are used transiently only as HMAC input, never returned or stored.
  return `${Math.floor(latitude * 100) / 100},${Math.floor(longitude * 100) / 100}`;
}

export class HmacFareLegKeyFactory implements FareLegKeyFactory {
  private readonly secret = process.env.FARE_CONFIRMATION_HMAC_SECRET?.trim() || fallbackSecret;

  create(input: Parameters<FareLegKeyFactory["create"]>[0]): string {
    const segment = input.route.segments[input.segmentIndex];
    if (!segment) throw new Error("Cannot create a fare key for a missing segment.");

    const fingerprint = [
      "fare-leg:v1",
      segment.source.type,
      coarseCell(segment.origin.coordinate.latitude, segment.origin.coordinate.longitude),
      coarseCell(segment.destination.coordinate.latitude, segment.destination.coordinate.longitude),
      segment.mode,
      input.segmentIndex,
      input.discountClass,
    ].join("|");
    const digest = createHmac("sha256", this.secret)
      .update(fingerprint)
      .digest("base64url")
      .slice(0, 22);
    return `fare-leg:v1:${segment.mode}:${input.segmentIndex}:${input.discountClass}:${digest}`;
  }
}
