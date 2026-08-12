import { z } from "zod";
import { countTransitTransfers } from "@/domain/commute/route-metrics";

export const coordinateSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

export const locationSchema = z.object({
  label: z.string().trim().min(1),
  coordinate: coordinateSchema,
});

export const dataSourceSchema = z.object({
  type: z.enum(["official", "gtfs", "crowdsourced", "estimated", "demo"]),
  name: z.string().trim().min(1),
  sourceUrl: z.url().optional(),
  retrievedAt: z.iso.datetime().optional(),
  effectiveDate: z.iso.date().optional(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
});

export const commuteSegmentSchema = z.object({
  mode: z.enum(["walk", "jeepney", "bus", "rail", "uv-express", "p2p", "tricycle", "other"]),
  origin: locationSchema,
  destination: locationSchema,
  estimatedFare: z.number().finite().nonnegative(),
  estimatedDurationMinutes: z.number().finite().nonnegative(),
  source: dataSourceSchema,
});

export const commuteRouteSchema = z
  .object({
    id: z.string().trim().min(1),
    segments: z.array(commuteSegmentSchema).min(1),
    oneWayFare: z.number().finite().nonnegative(),
    oneWayDurationMinutes: z.number().finite().nonnegative(),
    transfers: z.number().int().nonnegative(),
    reliability: z.enum(["high", "medium", "low"]),
    sources: z.array(dataSourceSchema).min(1),
  })
  .superRefine((route, context) => {
    const segmentFare = route.segments.reduce((total, segment) => total + segment.estimatedFare, 0);
    const segmentMinutes = route.segments.reduce(
      (total, segment) => total + segment.estimatedDurationMinutes,
      0,
    );

    if (Math.abs(segmentFare - route.oneWayFare) > 0.01) {
      context.addIssue({
        code: "custom",
        path: ["oneWayFare"],
        message: "One-way fare must equal the sum of segment fares.",
      });
    }
    if (Math.abs(segmentMinutes - route.oneWayDurationMinutes) > 0.01) {
      context.addIssue({
        code: "custom",
        path: ["oneWayDurationMinutes"],
        message: "One-way duration must equal the sum of segment durations.",
      });
    }
    if (route.transfers !== countTransitTransfers(route.segments)) {
      context.addIssue({
        code: "custom",
        path: ["transfers"],
        message: "Transfers must match the number of route changes.",
      });
    }
  });
