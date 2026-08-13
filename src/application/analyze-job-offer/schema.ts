import { z } from "zod";
import { countOnsiteDays, countWorkingDays, deriveWorkArrangement } from "@/domain/work-schedule";
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
      onsiteDaysPerWeek: z.number().int().min(0).max(7),
      workingDaysPerWeek: z.number().int().min(1).max(7).optional(),
      weeklySchedule: z
        .object({
          monday: z.enum(["onsite", "wfh", "off"]),
          tuesday: z.enum(["onsite", "wfh", "off"]),
          wednesday: z.enum(["onsite", "wfh", "off"]),
          thursday: z.enum(["onsite", "wfh", "off"]),
          friday: z.enum(["onsite", "wfh", "off"]),
          saturday: z.enum(["onsite", "wfh", "off"]),
          sunday: z.enum(["onsite", "wfh", "off"]),
        })
        .optional(),
      workingHoursPerDay: z.number().positive().max(24),
      payrollDeductions: z
        .object({
          sss: z.boolean(),
          philhealth: z.boolean(),
          pagibig: z.boolean(),
          withholdingTax: z.boolean(),
        })
        .optional(),
      /** Legacy compatibility for clients that have not migrated to payrollDeductions. */
      estimatedTakeHomeRate: z.number().min(0.5).max(1).default(0.9),
    })
    .superRefine((job, context) => {
      if (job.weeklySchedule) {
        const onsiteDays = countOnsiteDays(job.weeklySchedule);
        const workingDays = countWorkingDays(job.weeklySchedule);
        const arrangement = deriveWorkArrangement(job.weeklySchedule);
        if (workingDays === 0) {
          context.addIssue({
            code: "custom",
            path: ["weeklySchedule"],
            message: "Select at least one working day.",
          });
        }
        if (job.onsiteDaysPerWeek !== onsiteDays) {
          context.addIssue({
            code: "custom",
            path: ["onsiteDaysPerWeek"],
            message: "Office-day count must match the weekly schedule.",
          });
        }
        if (job.workingDaysPerWeek !== workingDays) {
          context.addIssue({
            code: "custom",
            path: ["workingDaysPerWeek"],
            message: "Working-day count must match the weekly schedule.",
          });
        }
        if (job.workArrangement !== arrangement) {
          context.addIssue({
            code: "custom",
            path: ["workArrangement"],
            message: "Work arrangement must match the weekly schedule.",
          });
        }
      }
      const workingDays = job.workingDaysPerWeek ?? 5;
      if (job.onsiteDaysPerWeek > workingDays) {
        context.addIssue({
          code: "custom",
          path: ["onsiteDaysPerWeek"],
          message: "Office days cannot exceed total working days.",
        });
      }
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
