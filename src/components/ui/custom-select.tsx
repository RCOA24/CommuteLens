"use client";

import { useEffect, useId, useRef, useState } from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
  id?: string;
}

/**
 * Custom dropdown that renders its own option list so text size, padding,
 * and font remain consistent with the rest of the form. Replaces native
 * <select> which ignores CSS inside its expanded popup on most browsers.
 */
export function CustomSelect({
  options,
  value,
  onChange,
  label,
  disabled = false,
  id: externalId,
}: CustomSelectProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = `${id}-listbox`;

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleKeyDown(event: React.KeyboardEvent) {
    switch (event.key) {
      case "Enter":
      case " ":
        event.preventDefault();
        if (isOpen && activeIndex >= 0) {
          onChange(options[activeIndex].value);
          setIsOpen(false);
          setActiveIndex(-1);
        } else {
          setIsOpen(true);
        }
        break;
      case "ArrowDown":
        event.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
          setActiveIndex(0);
        } else {
          setActiveIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (isOpen) {
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
        }
        break;
      case "Escape":
        setIsOpen(false);
        setActiveIndex(-1);
        break;
      case "Tab":
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  }

  function handleSelect(optionValue: string) {
    onChange(optionValue);
    setIsOpen(false);
    setActiveIndex(-1);
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1.5 block text-[0.68rem] font-bold tracking-[0.14em] text-muted uppercase">
        {label}
      </label>
      <button
        type="button"
        id={id}
        className="flex h-9 w-full items-center justify-between rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-left text-sm leading-tight text-ink transition-colors hover:border-ink/30 focus:border-accent focus:outline-2 focus:outline-offset-1 focus:outline-accent disabled:opacity-40"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
      >
        <span className="truncate">{selectedOption?.label ?? "Select..."}</span>
        <svg
          className={`ml-2 h-3 w-3 shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
          viewBox="0 0 12 12"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M2 4l4 4 4-4" />
        </svg>
      </button>
      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute top-full left-0 z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-ink/10 bg-white py-1 shadow-lg"
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={option.value === value}
              className={`cursor-pointer px-3 py-1.5 text-sm leading-tight ${
                option.value === value
                  ? "bg-ink/5 font-semibold text-ink"
                  : index === activeIndex
                    ? "bg-ink/5 text-ink"
                    : "text-ink/80 hover:bg-ink/5"
              }`}
              onMouseDown={() => handleSelect(option.value)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
