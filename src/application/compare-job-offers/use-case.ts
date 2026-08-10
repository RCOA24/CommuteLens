import type { AnalyzeJobOfferResult } from "@/application/analyze-job-offer/use-case";
import { AnalyzeJobOfferUseCase } from "@/application/analyze-job-offer/use-case";
import { compareJobRealities } from "@/domain/job/comparison";
import type { JobRealityComparison } from "@/domain/models";
import type { TransitProvider } from "@/providers/transit/transit-provider";
import { compareJobOffersSchema } from "./schema";

export type CompareJobOffersResult =
  | { success: true; data: JobRealityComparison }
  | Extract<AnalyzeJobOfferResult, { success: false }>;

export class CompareJobOffersUseCase {
  private readonly analyzer: AnalyzeJobOfferUseCase;

  constructor(transitProvider: TransitProvider) {
    this.analyzer = new AnalyzeJobOfferUseCase(transitProvider);
  }

  async execute(untrustedInput: unknown): Promise<CompareJobOffersResult> {
    const parsed = compareJobOffersSchema.safeParse(untrustedInput);
    if (!parsed.success) {
      return {
        success: false,
        error: {
          code: "INVALID_INPUT",
          message: parsed.error.issues[0]?.message ?? "Invalid comparison input.",
        },
      };
    }

    const [jobA, jobB] = await Promise.all([
      this.analyzer.execute(parsed.data.jobA),
      this.analyzer.execute(parsed.data.jobB),
    ]);

    if (!jobA.success) return jobA;
    if (!jobB.success) return jobB;

    return {
      success: true,
      data: compareJobRealities(jobA.data, jobB.data),
    };
  }
}
