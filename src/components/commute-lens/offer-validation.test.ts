import { describe, expect, it } from "vitest";
import { analyzeJobOfferSchema } from "@/application/analyze-job-offer/schema";
import { DEMO_OFFICES, DEMO_ORIGINS } from "@/data/demo";
import {
  countErrors,
  firstErrorField,
  summariseErrors,
  validateOfferDraft,
  type OfferDraft,
} from "./offer-validation";

const validDraft: OfferDraft = {
  title: "Software Developer",
  company: "Demo Tech Manila",
  salary: "70000",
  workingHours: "8",
  takeHomePercent: "90",
};

function serverAccepts(draft: OfferDraft) {
  return analyzeJobOfferSchema.safeParse({
    origin: DEMO_ORIGINS.cubao,
    route: null,
    jobOffer: {
      id: "job-1",
      title: draft.title.trim(),
      company: draft.company.trim(),
      monthlySalary: Number(draft.salary),
      officeLocation: DEMO_OFFICES.bgc,
      workArrangement: "hybrid" as const,
      onsiteDaysPerWeek: 3,
      workingHoursPerDay: Number(draft.workingHours),
      estimatedTakeHomeRate: Number(draft.takeHomePercent) / 100,
    },
  }).success;
}

describe("validateOfferDraft", () => {
  it("accepts a complete draft", () => {
    expect(validateOfferDraft(validDraft)).toEqual({});
    expect(summariseErrors(validateOfferDraft(validDraft))).toBeNull();
  });

  it("flags blank text fields", () => {
    const errors = validateOfferDraft({ ...validDraft, title: "   ", company: "" });
    expect(errors.title).toBeDefined();
    expect(errors.company).toBeDefined();
    expect(firstErrorField(errors)).toBe("title");
  });

  it("rejects a missing or non-positive salary", () => {
    expect(validateOfferDraft({ ...validDraft, salary: "" }).salary).toBeDefined();
    expect(validateOfferDraft({ ...validDraft, salary: "0" }).salary).toBeDefined();
  });

  it("keeps working hours inside a real day", () => {
    expect(validateOfferDraft({ ...validDraft, workingHours: "0" }).workingHours).toBeDefined();
    expect(validateOfferDraft({ ...validDraft, workingHours: "25" }).workingHours).toBeDefined();
    expect(validateOfferDraft({ ...validDraft, workingHours: "7.5" }).workingHours).toBeUndefined();
  });

  it("keeps the take-home estimate inside the disclosed band", () => {
    expect(
      validateOfferDraft({ ...validDraft, takeHomePercent: "49" }).takeHomePercent,
    ).toBeDefined();
    expect(
      validateOfferDraft({ ...validDraft, takeHomePercent: "101" }).takeHomePercent,
    ).toBeDefined();
    expect(
      validateOfferDraft({ ...validDraft, takeHomePercent: "50" }).takeHomePercent,
    ).toBeUndefined();
  });

  it("summarises how many fields need attention", () => {
    const errors = validateOfferDraft({
      title: "",
      company: "",
      salary: "",
      workingHours: "",
      takeHomePercent: "",
    });
    expect(countErrors(errors)).toBe(5);
    expect(summariseErrors(errors)).toContain("5 fields");
  });

  /**
   * The point of the client rules is that they never let through a payload the
   * server would reject, and never block one the server would accept.
   */
  it("agrees with the server schema at the boundaries", () => {
    const boundaryDrafts: OfferDraft[] = [
      validDraft,
      { ...validDraft, takeHomePercent: "50" },
      { ...validDraft, takeHomePercent: "100" },
      { ...validDraft, workingHours: "24" },
      { ...validDraft, salary: "1" },
    ];
    for (const draft of boundaryDrafts) {
      expect(validateOfferDraft(draft)).toEqual({});
      expect(serverAccepts(draft)).toBe(true);
    }

    const invalidDrafts: OfferDraft[] = [
      { ...validDraft, takeHomePercent: "49" },
      { ...validDraft, takeHomePercent: "101" },
      { ...validDraft, workingHours: "25" },
      { ...validDraft, salary: "0" },
      { ...validDraft, title: "" },
    ];
    for (const draft of invalidDrafts) {
      expect(countErrors(validateOfferDraft(draft))).toBeGreaterThan(0);
      expect(serverAccepts(draft)).toBe(false);
    }
  });
});
