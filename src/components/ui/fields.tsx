"use client";

import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Field primitives.
 *
 * Two rules hold across all of them:
 *  1. Every control has a real <label htmlFor>, and hints and errors are wired
 *     through aria-describedby rather than left as decoration.
 *  2. Numeric inputs are `type="text"` with an `inputMode` hint. Native number
 *     inputs bring step/min validation bubbles and scroll-wheel mutation, both
 *     of which we explicitly do not want. Values are parsed and validated by
 *     the form before they reach the domain layer.
 */

function describedBy(id: string, hint: ReactNode, error: string | null | undefined) {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

/**
 * Hint and error messages. Errors are not `role="alert"` on purpose: a form
 * with four invalid fields would fire four announcements. The form owns a
 * single summary alert instead, and these are reached via aria-describedby.
 */
export function FieldMessages({
  id,
  hint,
  error,
}: {
  id: string;
  hint?: ReactNode;
  error?: string | null;
}) {
  return (
    <>
      {hint && (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={`${id}-error`}>
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
    </>
  );
}

export function TextField({
  id,
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  hint,
  error,
  autoComplete = "off",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  hint?: ReactNode;
  error?: string | null;
  autoComplete?: string;
}) {
  return (
    <div className="min-w-0">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="text-field"
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
      />
      <FieldMessages id={id} hint={hint} error={error} />
    </div>
  );
}

/** Keeps only digits and a single decimal point, so the value is always parseable. */
export function sanitizeAmount(raw: string): string {
  const stripped = raw.replace(/[^\d.]/g, "");
  const [whole, ...rest] = stripped.split(".");
  return rest.length > 0 ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
}

export function CurrencyField({
  id,
  label,
  value,
  onChange,
  onBlur,
  hint,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  hint?: ReactNode;
  error?: string | null;
}) {
  return (
    <div className="min-w-0">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="currency-field" data-invalid={error ? "true" : undefined}>
        <span aria-hidden="true">₱</span>
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          onChange={(event) => onChange(sanitizeAmount(event.target.value))}
          onBlur={onBlur}
        />
      </div>
      <FieldMessages id={id} hint={hint} error={error} />
    </div>
  );
}

/** A short numeric field with a trailing unit, for hours and percentages. */
export function UnitField({
  id,
  label,
  unit,
  value,
  onChange,
  onBlur,
  hint,
  error,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  hint?: ReactNode;
  error?: string | null;
}) {
  return (
    <div className="min-w-0">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="unit-field" data-invalid={error ? "true" : undefined}>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          onChange={(event) => onChange(sanitizeAmount(event.target.value))}
          onBlur={onBlur}
        />
        <span aria-hidden="true">{unit}</span>
      </div>
      <FieldMessages id={id} hint={hint} error={error} />
    </div>
  );
}

/**
 * A single summary alert for a form. Announced once, after a submit attempt.
 */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-[1.1rem] border border-danger/30 bg-danger/10 p-3.5 text-sm font-bold text-danger"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
