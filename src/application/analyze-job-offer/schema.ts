import { z } from "zod";

const coordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const locationSchema = z.object({ label: z.string().trim().min(1), coordinate: coordinateSchema });

export const analyzeJobOfferSchema = z.object({
  origin: locationSchema,
  jobOffer: z.object({
    id: z.string().trim().min(1),
    title: z.string().trim().min(1),
    company: z.string().trim().min(1),
    monthlySalary: z.number().positive(),
    officeLocation: locationSchema,
    workArrangement: z.enum(["onsite", "hybrid", "remote"]),
    onsiteDaysPerWeek: z.number().int().min(0).max(5),
    workingHoursPerDay: z.number().positive().max(24),
  }).superRefine((job, context) => {
    if (job.workArrangement === "remote" && job.onsiteDaysPerWeek !== 0) {
      context.addIssue({ code: "custom", path: ["onsiteDaysPerWeek"], message: "Remote jobs must have zero onsite days." });
    }
    if (job.workArrangement === "onsite" && job.onsiteDaysPerWeek === 0) {
      context.addIssue({ code: "custom", path: ["onsiteDaysPerWeek"], message: "Onsite jobs must have at least one onsite day." });
    }
  }),
});

export type AnalyzeJobOfferInput = z.infer<typeof analyzeJobOfferSchema>;
