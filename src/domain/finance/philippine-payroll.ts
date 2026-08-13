export const PH_PAYROLL_POLICY = {
  id: "ph-employed-2026",
  label: "Philippine employed-member estimate",
  checkedOn: "2026-08-13",
  sources: [
    {
      id: "sss" as const,
      label: "SSS employee contribution",
      shortLabel: "SSS",
      sourceUrl: "https://www.sss.gov.ph/pay-contribution/",
      effectiveLabel: "15% total contribution effective January 2025; 5% employee share",
    },
    {
      id: "philhealth" as const,
      label: "PhilHealth employee premium",
      shortLabel: "PhilHealth",
      sourceUrl: "https://www.philhealth.gov.ph/news/2019/new_contri.php",
      effectiveLabel: "5% premium with ₱10,000 floor and ₱100,000 ceiling; employee half",
    },
    {
      id: "pagibig" as const,
      label: "Pag-IBIG employee savings",
      shortLabel: "Pag-IBIG",
      sourceUrl: "https://oca.judiciary.gov.ph/wp-content/uploads/OCA-Circular-No.-25-2024.pdf",
      effectiveLabel: "1%/2% employee rate with ₱10,000 maximum fund salary",
    },
    {
      id: "withholdingTax" as const,
      label: "BIR withholding tax",
      shortLabel: "Withholding tax",
      sourceUrl: "https://bir-cdn.bir.gov.ph/local/pdf/Annex%20E%20RR%2011-2018.pdf",
      effectiveLabel: "Monthly withholding table effective January 2023 onward",
    },
  ],
} as const;

export type PayrollDeductionId = (typeof PH_PAYROLL_POLICY.sources)[number]["id"];

export interface PayrollDeductionSelection {
  sss: boolean;
  philhealth: boolean;
  pagibig: boolean;
  withholdingTax: boolean;
}

export interface PayrollDeductionLine {
  id: PayrollDeductionId;
  label: string;
  amount: number;
  sourceUrl: string;
}

export interface PhilippinePayrollEstimate {
  policyId: typeof PH_PAYROLL_POLICY.id;
  policyLabel: string;
  checkedOn: string;
  grossMonthlyPay: number;
  taxableMonthlyPay: number;
  deductions: PayrollDeductionLine[];
  totalDeductions: number;
  estimatedTakeHomePay: number;
}

export const DEFAULT_PAYROLL_DEDUCTIONS: Readonly<PayrollDeductionSelection> = Object.freeze({
  sss: true,
  philhealth: true,
  pagibig: true,
  withholdingTax: true,
});

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function assertMonthlySalary(value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError("Monthly salary must be a non-negative finite number.");
  }
}

/** Employee share: 5% of the applicable ₱500-step MSC, from ₱5,000 to ₱35,000. */
export function calculateSssEmployeeContribution(monthlySalary: number): number {
  assertMonthlySalary(monthlySalary);
  if (monthlySalary === 0) return 0;
  const monthlySalaryCredit = Math.min(
    35_000,
    Math.max(5_000, Math.round(monthlySalary / 500) * 500),
  );
  return roundCurrency(monthlySalaryCredit * 0.05);
}

/** Employed-member half of the 5% premium on the statutory salary floor/ceiling. */
export function calculatePhilHealthEmployeeContribution(monthlySalary: number): number {
  assertMonthlySalary(monthlySalary);
  if (monthlySalary === 0) return 0;
  const premiumBase = Math.min(100_000, Math.max(10_000, monthlySalary));
  return roundCurrency(premiumBase * 0.025);
}

/** Employee savings under the ₱10,000 maximum fund salary effective February 2024. */
export function calculatePagIbigEmployeeContribution(monthlySalary: number): number {
  assertMonthlySalary(monthlySalary);
  if (monthlySalary === 0) return 0;
  const fundSalary = Math.min(10_000, monthlySalary);
  return roundCurrency(fundSalary * (monthlySalary <= 1_500 ? 0.01 : 0.02));
}

/** BIR monthly withholding table effective January 2023 onward. */
export function calculateMonthlyWithholdingTax(taxableMonthlyPay: number): number {
  assertMonthlySalary(taxableMonthlyPay);
  if (taxableMonthlyPay <= 20_833) return 0;
  if (taxableMonthlyPay <= 33_332) return roundCurrency((taxableMonthlyPay - 20_833) * 0.15);
  if (taxableMonthlyPay <= 66_666) return roundCurrency(1_875 + (taxableMonthlyPay - 33_333) * 0.2);
  if (taxableMonthlyPay <= 166_666)
    return roundCurrency(8_541.8 + (taxableMonthlyPay - 66_667) * 0.25);
  if (taxableMonthlyPay <= 666_666)
    return roundCurrency(33_541.8 + (taxableMonthlyPay - 166_667) * 0.3);
  return roundCurrency(183_541.8 + (taxableMonthlyPay - 666_667) * 0.35);
}

export function estimatePhilippinePayroll(
  monthlySalary: number,
  selection: PayrollDeductionSelection = DEFAULT_PAYROLL_DEDUCTIONS,
): PhilippinePayrollEstimate {
  assertMonthlySalary(monthlySalary);

  const policyById = new Map(PH_PAYROLL_POLICY.sources.map((source) => [source.id, source]));
  const deductions: PayrollDeductionLine[] = [];
  const add = (id: PayrollDeductionId, amount: number) => {
    if (amount <= 0) return;
    const policy = policyById.get(id);
    if (!policy) return;
    deductions.push({ id, label: policy.label, amount, sourceUrl: policy.sourceUrl });
  };

  const sss = selection.sss ? calculateSssEmployeeContribution(monthlySalary) : 0;
  const philhealth = selection.philhealth
    ? calculatePhilHealthEmployeeContribution(monthlySalary)
    : 0;
  const pagibig = selection.pagibig ? calculatePagIbigEmployeeContribution(monthlySalary) : 0;
  add("sss", sss);
  add("philhealth", philhealth);
  add("pagibig", pagibig);

  const taxableMonthlyPay = Math.max(0, monthlySalary - sss - philhealth - pagibig);
  if (selection.withholdingTax) {
    add("withholdingTax", calculateMonthlyWithholdingTax(taxableMonthlyPay));
  }

  const totalDeductions = roundCurrency(
    deductions.reduce((total, deduction) => total + deduction.amount, 0),
  );

  return {
    policyId: PH_PAYROLL_POLICY.id,
    policyLabel: PH_PAYROLL_POLICY.label,
    checkedOn: PH_PAYROLL_POLICY.checkedOn,
    grossMonthlyPay: roundCurrency(monthlySalary),
    taxableMonthlyPay: roundCurrency(taxableMonthlyPay),
    deductions,
    totalDeductions,
    estimatedTakeHomePay: roundCurrency(Math.max(0, monthlySalary - totalDeductions)),
  };
}
