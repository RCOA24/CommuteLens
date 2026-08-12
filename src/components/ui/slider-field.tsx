"use client";

import { useId, type CSSProperties, type ReactNode } from "react";

/**
 * A labelled range input.
 *
 * The id comes from `useId`, not from the label text: the previous version
 * built ids like "ONSITE DAYS / WEEK-range", which are neither valid CSS
 * selectors nor stable across copy changes.
 */
export function SliderField({
  label,
  value,
  min,
  max,
  onChange,
  valueLabel,
  ticks,
  describedBy,
  className = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  /** Human-readable rendering of the current value, e.g. "3 days". */
  valueLabel?: ReactNode;
  /** Optional tick captions, rendered evenly across the track. */
  ticks?: readonly string[];
  describedBy?: string;
  className?: string;
}) {
  const id = useId();
  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;

  return (
    <div className={className}>
      <div className="flex items-end justify-between gap-3">
        <label className="field-label !mb-0" htmlFor={id}>
          {label}
        </label>
        <output
          className="font-headline text-2xl leading-none font-black numeric"
          htmlFor={id}
          aria-live="off"
        >
          {valueLabel ?? value}
        </output>
      </div>
      <input
        id={id}
        className="range-slider mt-1"
        style={{ "--range-progress": `${percent}%` } as CSSProperties}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        aria-describedby={describedBy}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      {ticks && (
        <div className="range-ticks" aria-hidden="true">
          {ticks.map((tick, index) => (
            <span
              key={tick}
              className={
                index === 0
                  ? "text-left"
                  : index === ticks.length - 1
                    ? "text-right"
                    : "text-center"
              }
            >
              {tick}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
