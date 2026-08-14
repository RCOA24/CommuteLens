"use client";

import { ArrowRight } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { Eyebrow } from "@/components/ui/typography";

/**
 * The explicit way into the closing screen.
 *
 * Finishing and starting over are different intentions, so they get different
 * controls. This appears at the end of both the result and the comparison,
 * because a user may decide they are done after one offer or after two — the
 * journey has no single mandatory last step.
 *
 * Nothing is lost by taking it: the closing screen can return to the result.
 */
export function JourneyWrapUp({
  context,
  onFinish,
}: {
  context: "reality" | "compare";
  onFinish: () => void;
}) {
  const isAfterCompare = context === "compare";

  return (
    <section className="app-panel mx-auto mt-6 max-w-5xl p-5 sm:p-6 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <Eyebrow tone="flame">Last step</Eyebrow>
          <h2 className="mt-2 font-headline text-lg font-black tracking-[-0.02em]">
            {isAfterCompare ? "Done comparing?" : "Finished with this offer?"}
          </h2>
          <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted">
            {isAfterCompare
              ? "Close the file and we will sum up what the two offers actually cost you."
              : "Close the file and we will sum up what this offer actually leaves you with."}{" "}
            You can come straight back to this screen afterwards.
          </p>
        </div>
        <ActionButton onClick={onFinish}>
          Wrap up
          <ArrowRight className="size-4" aria-hidden="true" />
        </ActionButton>
      </div>
    </section>
  );
}
