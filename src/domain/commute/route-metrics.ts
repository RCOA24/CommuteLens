import type { CommuteSegment } from "@/domain/models";

/** Access and egress walks are journey legs, not public-transport transfers. */
export function countTransitTransfers(segments: readonly CommuteSegment[]): number {
  const transitLegs = segments.filter((segment) => segment.mode !== "walk");
  return Math.max(0, transitLegs.length - 1);
}
