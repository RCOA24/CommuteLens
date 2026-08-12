/**
 * Statutory fare discounts for Philippine public transport.
 *
 * Three separate laws each mandate the same 20% discount on public utility
 * vehicle fares. They are modelled as one rate with three legal bases rather
 * than as a single "discount" flag, because the receipt has to be able to say
 * *which* entitlement was applied.
 *
 * This module holds no fare arithmetic — see `fare-calculation.ts`.
 */

import type { FareDiscountClassName } from "@/domain/models";

/** One source of truth: the union lives on the model so persisted shapes match. */
export type FareDiscountClass = FareDiscountClassName;

/** All three statutes mandate the same rate. */
export const MANDATED_DISCOUNT_RATE = 0.2;

export interface FareDiscountDescriptor {
  discountClass: FareDiscountClass;
  /** Control label. */
  label: string;
  /** Short badge text for the receipt. */
  shortLabel: string;
  rate: number;
  /** The statute that entitles the passenger, or null for regular fare. */
  legalBasis: string | null;
  /** One line, safe to render verbatim. */
  note: string;
}

export const FARE_DISCOUNTS: Readonly<Record<FareDiscountClass, FareDiscountDescriptor>> =
  Object.freeze({
    regular: {
      discountClass: "regular",
      label: "Regular",
      shortLabel: "Regular fare",
      rate: 0,
      legalBasis: null,
      note: "Full published fare, with no statutory discount applied.",
    },
    student: {
      discountClass: "student",
      label: "Student",
      shortLabel: "Student fare",
      rate: MANDATED_DISCOUNT_RATE,
      legalBasis: "Republic Act 11314 (Student Fare Discount Act)",
      note: "Students are entitled to a 20% discount on public utility vehicle fares. Carry a valid school ID.",
    },
    senior: {
      discountClass: "senior",
      label: "Senior citizen",
      shortLabel: "Senior fare",
      rate: MANDATED_DISCOUNT_RATE,
      legalBasis: "Republic Act 9994 (Expanded Senior Citizens Act of 2010)",
      note: "Senior citizens are entitled to a 20% discount on public transport fares.",
    },
    pwd: {
      discountClass: "pwd",
      label: "PWD",
      shortLabel: "PWD fare",
      rate: MANDATED_DISCOUNT_RATE,
      legalBasis: "Republic Act 10754 (expanded benefits for persons with disability)",
      note: "Persons with disability are entitled to a 20% discount on public transport fares.",
    },
  });

export function fareDiscountRate(discountClass: FareDiscountClass): number {
  return FARE_DISCOUNTS[discountClass].rate;
}

export function describeFareDiscount(discountClass: FareDiscountClass): FareDiscountDescriptor {
  return FARE_DISCOUNTS[discountClass];
}

export const FARE_DISCOUNT_CLASSES: readonly FareDiscountClass[] = Object.freeze([
  "regular",
  "student",
  "senior",
  "pwd",
]);
