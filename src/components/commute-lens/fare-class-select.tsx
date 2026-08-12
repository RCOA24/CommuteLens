"use client";

import { Accessibility, GraduationCap, PersonStanding, Ticket } from "lucide-react";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import { FARE_DISCOUNTS, type FareDiscountClass } from "@/domain/fare";

/**
 * Statutory fare entitlement.
 *
 * Three Philippine laws each mandate a 20% discount on public utility vehicle
 * fares, and the app previously modelled none of them — every commuter was
 * quoted full fare. For a student audience in particular that is not a rounding
 * error: it is the difference between a commute costing what the tool says and
 * costing a fifth less.
 *
 * The card notes name the statute so the entitlement reads as a right rather
 * than as a discount code.
 */
const OPTIONS: readonly ChoiceOption<FareDiscountClass>[] = [
  { value: "regular", title: "Regular", note: "Full fare", icon: <Ticket /> },
  { value: "student", title: "Student", note: "20% off · RA 11314", icon: <GraduationCap /> },
  { value: "senior", title: "Senior", note: "20% off · RA 9994", icon: <PersonStanding /> },
  { value: "pwd", title: "PWD", note: "20% off · RA 10754", icon: <Accessibility /> },
];

export function FareClassSelect({
  name,
  value,
  onChange,
  className = "",
}: {
  name: string;
  value: FareDiscountClass;
  onChange: (value: FareDiscountClass) => void;
  className?: string;
}) {
  const descriptor = FARE_DISCOUNTS[value];
  return (
    <ChoiceGroup
      className={className}
      name={name}
      legend="Your fare class"
      value={value}
      options={OPTIONS}
      onChange={onChange}
      columns={2}
      hint={
        descriptor.legalBasis ? (
          <>
            {descriptor.note} <span className="font-bold">{descriptor.legalBasis}</span>
          </>
        ) : (
          descriptor.note
        )
      }
    />
  );
}
