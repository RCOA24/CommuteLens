"use client";

import { Check } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Native radio groups dressed as cards.
 *
 * Using real <input type="radio"> inside a <fieldset> means arrow-key
 * navigation, group announcement, and form semantics all come for free. The
 * input is visually hidden but never `display:none`, so it stays focusable, and
 * the card carries the focus ring via `:has(input:focus-visible)`.
 */

export interface ChoiceOption<TValue extends string> {
  value: TValue;
  title: string;
  /** One line explaining what choosing this actually means. */
  note: string;
  icon: ReactNode;
}

export function ChoiceGroup<TValue extends string>({
  name,
  legend,
  value,
  options,
  onChange,
  columns = 3,
  hint,
  className = "",
}: {
  name: string;
  legend: string;
  value: TValue;
  options: readonly ChoiceOption<TValue>[];
  onChange: (value: TValue) => void;
  /** Column count above the stacking breakpoint. */
  columns?: 2 | 3;
  /** Rendered below the group, e.g. the legal basis of the current choice. */
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={className}>
      <legend className="field-label">{legend}</legend>
      <div className="choice-grid" data-columns={columns === 2 ? "2" : undefined}>
        {options.map((option) => (
          <label key={option.value} className="choice-card">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span aria-hidden="true" className="mt-0.5 shrink-0 [&>svg]:size-4">
              {option.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="choice-card-title">{option.title}</span>
              <span className="choice-card-note">{option.note}</span>
            </span>
            {value === option.value && (
              <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            )}
          </label>
        ))}
      </div>
      {hint && <p className="field-hint">{hint}</p>}
    </fieldset>
  );
}

/**
 * Office days a week, as a filled quantity rather than an abstract slider.
 * Every pill up to the selection is tinted, so the control reads as "three out
 * of five" at a glance instead of requiring the user to read a number.
 */
export function DayCountGroup({
  name,
  legend,
  value,
  onChange,
  hint,
  className = "",
}: {
  name: string;
  legend: string;
  value: number;
  onChange: (value: number) => void;
  hint?: ReactNode;
  className?: string;
}) {
  const days = [1, 2, 3, 4, 5];
  return (
    <fieldset className={className}>
      <legend className="field-label">{legend}</legend>
      <div className="day-grid">
        {days.map((day) => (
          <label
            key={day}
            className="day-pill"
            data-selected={value === day}
            data-filled={day <= value}
          >
            <input
              type="radio"
              name={name}
              value={day}
              checked={value === day}
              onChange={() => onChange(day)}
            />
            <span aria-hidden="true">{day}</span>
            <span className="sr-only">
              {day} office {day === 1 ? "day" : "days"} a week
            </span>
          </label>
        ))}
      </div>
      {hint && <p className="field-hint">{hint}</p>}
    </fieldset>
  );
}
