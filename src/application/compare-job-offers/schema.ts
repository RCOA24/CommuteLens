import { z } from "zod";
import { analyzeJobOfferSchema } from "@/application/analyze-job-offer/schema";

export const compareJobOffersSchema = z.object({
  jobA: analyzeJobOfferSchema,
  jobB: analyzeJobOfferSchema,
});

export type CompareJobOffersInput = z.infer<typeof compareJobOffersSchema>;
