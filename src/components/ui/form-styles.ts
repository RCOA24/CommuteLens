/**
 * Shared form-field style constants.
 *
 * Extracted so that both the single-offer analyzer and future multi-offer
 * comparison form render identical fields without duplicating class strings.
 */

export const fieldClass =
  "h-9 w-full rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-sm leading-tight text-ink placeholder:text-ink/35 focus:border-accent focus:outline-2 focus:outline-offset-1 focus:outline-accent disabled:opacity-40";

export const labelClass =
  "mb-1.5 block text-[0.68rem] font-bold tracking-[0.14em] text-muted uppercase";

export const errorClass = "mt-1.5 block text-[0.78rem] font-semibold text-accent";
