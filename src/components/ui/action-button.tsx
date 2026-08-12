import type { ButtonHTMLAttributes, ReactNode } from "react";

type ActionVariant = "primary" | "accent" | "secondary" | "quiet";

const VARIANT_CLASS: Record<ActionVariant, string> = {
  primary: "cl-button-primary",
  /** For ink surfaces, where an ink button would disappear. */
  accent: "cl-button-accent",
  secondary: "cl-button-secondary",
  quiet: "cl-button-quiet",
};

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ActionVariant;
  children: ReactNode;
}

/**
 * The single button system. `type` defaults to "button" because most of these
 * live inside a <form> and must not submit it by accident.
 */
export function ActionButton({
  variant = "primary",
  type = "button",
  className = "",
  children,
  ...props
}: ActionButtonProps) {
  return (
    <button type={type} className={`cl-button ${VARIANT_CLASS[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
