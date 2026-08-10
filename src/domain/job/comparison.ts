import type { ComparedMetric, JobRealityAnalysis, JobRealityComparison } from "@/domain/models";

function compareMetric(jobA: number, jobB: number): ComparedMetric {
  return { jobA, jobB, difference: jobB - jobA };
}

export function compareJobRealities(
  jobA: JobRealityAnalysis,
  jobB: JobRealityAnalysis,
): JobRealityComparison {
  return {
    jobA,
    jobB,
    metrics: {
      monthlySalary: compareMetric(jobA.jobOffer.monthlySalary, jobB.jobOffer.monthlySalary),
      estimatedTakeHomePay: compareMetric(jobA.estimatedTakeHomePay, jobB.estimatedTakeHomePay),
      monthlyCommuteCost: compareMetric(jobA.commute.monthlyFare, jobB.commute.monthlyFare),
      monthlyCommuteHours: compareMetric(jobA.monthlyCommuteHours, jobB.monthlyCommuteHours),
      incomeAfterCommute: compareMetric(jobA.incomeAfterCommute, jobB.incomeAfterCommute),
      commuteBurdenPercentage: compareMetric(
        jobA.commuteBurdenPercentage,
        jobB.commuteBurdenPercentage,
      ),
      effectiveHourlyValue: compareMetric(jobA.effectiveHourlyValue, jobB.effectiveHourlyValue),
    },
  };
}
