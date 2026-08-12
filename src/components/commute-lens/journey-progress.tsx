import { Check } from "lucide-react";

export const JOURNEY_STEPS = ["Commute", "Offer", "Reality", "Compare"] as const;

/**
 * A four-stop rail. Completed stops carry a check mark and the current stop is
 * marked with aria-current, so progress is never communicated by colour alone.
 */
export function JourneyProgress({ activeIndex }: { activeIndex: number }) {
  return (
    <nav className="mx-auto mt-5 max-w-2xl print:hidden" aria-label="Your progress">
      <ol className="grid grid-cols-4">
        {JOURNEY_STEPS.map((label, index) => {
          const isComplete = index < activeIndex;
          const isCurrent = index === activeIndex;
          return (
            <li
              key={label}
              className="relative flex min-w-0 flex-col items-center gap-2 text-center"
              aria-current={isCurrent ? "step" : undefined}
            >
              {index > 0 && (
                <span
                  aria-hidden="true"
                  className={`absolute top-[6px] right-1/2 h-[2px] w-full ${
                    index <= activeIndex ? "bg-accent" : "bg-ink/12"
                  }`}
                />
              )}
              <span
                aria-hidden="true"
                className={`relative z-10 grid size-3.5 place-items-center rounded-full border-2 transition-colors ${
                  isComplete
                    ? "border-accent bg-accent"
                    : isCurrent
                      ? "border-accent bg-paper ring-4 ring-accent/15"
                      : "border-ink/25 bg-canvas"
                }`}
              >
                {isComplete && <Check className="size-2 text-white" strokeWidth={5} />}
              </span>
              <span
                className={`max-w-full truncate text-[0.55rem] font-black tracking-[0.1em] uppercase sm:text-[0.62rem] sm:tracking-[0.14em] ${
                  isCurrent ? "text-ink" : isComplete ? "text-flame" : "text-muted/60"
                }`}
              >
                <span className="sr-only">
                  Step {index + 1} of {JOURNEY_STEPS.length}:{" "}
                </span>
                {label}
                {isComplete && <span className="sr-only"> (done)</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
