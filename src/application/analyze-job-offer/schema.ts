import { z } from "zod";
import { commuteRouteSchema, locationSchema } from "@/shared/validation/domain-schemas";

export const analyzeJobOfferSchema = z.object({
  origin: locationSchema,
  /** A route preview may be reused so preview and calculation cannot diverge. */
  route: commuteRouteSchema.nullable().optional(),
  /**
   * The passenger's statutory fare entitlement. A property of the commuter, not
   * of the offer, which is why it sits beside `origin` rather than inside
   * `jobOffer`. Defaults to full fare.
   */
  discountClass: z.enum(["regular", "student", "senior", "pwd"]).default("regular"),
  jobOffer: z
    .object({
      id: z.string().trim().min(1),
      title: z.string().trim().min(1),
      company: z.string().trim().min(1),
      monthlySalary: z.number().positive(),
      officeLocation: locationSchema,
      workArrangement: z.enum(["onsite", "hybrid", "remote"]),
      onsiteDaysPerWeek: z.number().int().min(0).max(5),
      workingHoursPerDay: z.number().positive().max(24),
      estimatedTakeHomeRate: z.number().min(0.5).max(1).default(0.9),
    })
    .superRefine((job, context) => {
      if (job.workArrangement === "remote" && job.onsiteDaysPerWeek !== 0) {
        context.addIssue({
          code: "custom",
          path: ["onsiteDaysPerWeek"],
          message: "Remote jobs must have zero onsite days.",
        });
      }
      if (job.workArrangement === "onsite" && job.onsiteDaysPerWeek === 0) {
        context.addIssue({
          code: "custom",
          path: ["onsiteDaysPerWeek"],
          message: "Onsite jobs must have at least one onsite day.",
        });
      }
    }),
});

export type AnalyzeJobOfferInput = z.infer<typeof analyzeJobOfferSchema>;
