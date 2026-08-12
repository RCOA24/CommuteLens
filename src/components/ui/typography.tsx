import type { ReactNode } from "react";

/** Small uppercase kicker used above every headline. */
export function Eyebrow({
  children,
  className = "",
  tone = "muted",
}: {
  children: ReactNode;
  className?: string;
  tone?: "muted" | "mint" | "flame";
}) {
  const toneClass = tone === "mint" ? "text-mint" : tone === "flame" ? "text-flame" : "text-muted";
  return (
    <p
      className={`text-[0.66rem] font-black tracking-[0.18em] uppercase ${toneClass} ${className}`}
    >
      {children}
    </p>
  );
}

/**
 * A numbered section header for the offer form. The number is decorative
 * reinforcement of an order the DOM already communicates, so it is aria-hidden.
 */
export function SectionHeading({
  step,
  title,
  description,
  className = "",
}: {
  step: number;
  title: string;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="flex items-center gap-2.5">
        <span className="section-step" aria-hidden="true">
          {step}
        </span>
        <h3 className="font-headline text-lg font-black tracking-[-0.02em]">{title}</h3>
      </div>
      {description && (
        <p className="mt-2 text-sm leading-relaxed text-muted sm:ml-[2.4rem]">{description}</p>
      )}
    </div>
  );
}
