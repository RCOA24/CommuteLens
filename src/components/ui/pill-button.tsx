import type { ButtonHTMLAttributes, ReactNode } from "react";

/* ==========================================================================
   PILL BUTTON — Rounded corners + inline SVG icon
   ========================================================================== */

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "md" | "lg";

interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconPosition?: "left" | "right";
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent/90 active:bg-accent/80 disabled:bg-accent/50",
  secondary: "bg-ink text-paper hover:bg-ink/90 active:bg-ink/80 disabled:bg-ink/50",
  ghost:
    "bg-transparent text-ink border-2 border-ink/20 hover:border-ink/40 hover:bg-ink/5 active:bg-ink/10 disabled:opacity-50",
};

const sizeStyles: Record<ButtonSize, string> = {
  md: "px-5 py-2.5 text-[0.82rem] gap-2",
  lg: "px-7 py-3.5 text-[0.92rem] gap-2.5",
};

/**
 * Pill-shaped button with optional SVG icon.
 *
 * Usage:
 * ```tsx
 * <PillButton icon={<PrinterIcon />}>Print Your Receipt</PillButton>
 * <PillButton variant="primary" icon={<SearchIcon />}>Show the real cost</PillButton>
 * ```
 */
export function PillButton({
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "left",
  children,
  className = "",
  ...props
}: PillButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-full font-headline font-bold tracking-[0.04em] uppercase transition-colors duration-150 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {icon && iconPosition === "left" && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
      {icon && iconPosition === "right" && <span className="shrink-0">{icon}</span>}
    </button>
  );
}

/* ==========================================================================
   SVG ICONS — Inline, 20×20, stroke-based for consistency
   ========================================================================== */

const ICON_CLASS = "h-[1.2em] w-[1.2em]";

/** Magnifying glass + chart — for "Show the real cost" */
export function AnalyzeIcon() {
  return (
    <svg
      className={ICON_CLASS}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="9" r="6" />
      <path d="M13.5 13.5 17 17" />
      <path d="M7 11V9M9 11V7M11 11V8" />
    </svg>
  );
}

/** Printer — for "Print Your Receipt" */
export function PrinterIcon() {
  return (
    <svg
      className={ICON_CLASS}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 7V2h10v5" />
      <rect x="2" y="7" width="16" height="8" rx="1" />
      <path d="M5 15v3h10v-3" />
      <circle cx="15" cy="10" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Scales / balance — for "Compare Jobs" */
export function CompareIcon() {
  return (
    <svg
      className={ICON_CLASS}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 2v16" />
      <path d="M4 6l6-2 6 2" />
      <path d="M4 6L2 12h4L4 6zM16 6l-2 6h4l-2-6z" />
      <path d="M8 18h4" />
    </svg>
  );
}

/** Location pin — for "Use My Location" */
export function LocationIcon() {
  return (
    <svg
      className={ICON_CLASS}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 18S4 12.5 4 8a6 6 0 0112 0c0 4.5-6 10-6 10z" />
      <circle cx="10" cy="8" r="2" />
    </svg>
  );
}

/** Plus circle — for "Add Job B" */
export function AddIcon() {
  return (
    <svg
      className={ICON_CLASS}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="7" />
      <path d="M10 7v6M7 10h6" />
    </svg>
  );
}

/** Download / Save — for "Save as PDF" */
export function DownloadIcon() {
  return (
    <svg
      className={ICON_CLASS}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 3v10M6 10l4 4 4-4" />
      <path d="M3 15v2h14v-2" />
    </svg>
  );
}

/** Share — for future share functionality */
export function ShareIcon() {
  return (
    <svg
      className={ICON_CLASS}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="14" cy="4" r="2.5" />
      <circle cx="14" cy="16" r="2.5" />
      <circle cx="6" cy="10" r="2.5" />
      <path d="M8.2 8.8l3.6-3.6M8.2 11.2l3.6 3.6" />
    </svg>
  );
}

/** Reset / new analysis */
export function ResetIcon() {
  return (
    <svg
      className={ICON_CLASS}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 10a6 6 0 0110.65-3.83" />
      <path d="M16 10a6 6 0 01-10.65 3.83" />
      <path d="M14 3l1 3.17L12 7" />
      <path d="M6 17l-1-3.17L8 13" />
    </svg>
  );
}
