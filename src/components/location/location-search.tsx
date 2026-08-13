"use client";

import { Check, Crosshair, LoaderCircle, MapPin, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { formatCoordinate, placeContext, shortPlace } from "@/components/commute-lens/format";
import type { Location } from "@/domain/models";

interface LocationSearchProps {
  value: Location | null;
  onChange: (location: Location | null) => void;
  label?: string;
  placeholder?: string;
  error?: string | null;
  idPrefix?: string;
  showCurrentLocation?: boolean;
}

/**
 * Explicit submit-to-search combobox. Queries reach the server-side provider
 * only when the user asks for them, which keeps API-key spend proportional to
 * intent rather than to keystrokes.
 *
 * Notes on the markup:
 *  - There is no nested <form>. This control is rendered inside other forms,
 *    and Enter is handled directly so the HTML stays valid.
 *  - Once a result is chosen we show the resolved coordinate. Seeing the pin
 *    land is what makes the search feel precise instead of approximate.
 */
export function LocationSearch({
  value,
  onChange,
  label = "WHERE YOU LIVE",
  placeholder = "Search a place, e.g. Cubao",
  error,
  idPrefix,
  showCurrentLocation = true,
}: LocationSearchProps) {
  const generatedId = useId();
  const id = idPrefix ?? generatedId;
  const [query, setQuery] = useState(value?.label ?? "");
  const [results, setResults] = useState<Location[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const requestRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = `${id}-listbox`;

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      requestRef.current?.abort();
    };
  }, []);

  async function search() {
    const normalized = query.trim();
    if (normalized.length < 3) {
      setLocationError("Enter at least 3 characters, then press Search.");
      return;
    }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setIsSearching(true);
    setLocationError(null);
    setStatus("Searching…");
    try {
      const response = await fetch(`/api/geocode/search?q=${encodeURIComponent(normalized)}`, {
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error?.message);
      setResults(data.data.results);
      setIsOpen(data.data.results.length > 0);
      setActiveIndex(-1);
      const count = data.data.results.length as number;
      if (count === 0) {
        setLocationError("No Philippine locations matched. Try a barangay, city, or landmark.");
        setStatus("No matches.");
      } else {
        setStatus(`${count} ${count === 1 ? "match" : "matches"}. Use arrow keys to review.`);
      }
    } catch (searchError) {
      if (searchError instanceof DOMException && searchError.name === "AbortError") return;
      setResults([]);
      setIsOpen(false);
      setStatus("");
      setLocationError("Location search is temporarily unavailable. Please try again.");
    } finally {
      if (requestRef.current === controller) setIsSearching(false);
    }
  }

  function select(location: Location) {
    setQuery(location.label);
    setResults([]);
    setIsOpen(false);
    setActiveIndex(-1);
    setLocationError(null);
    setStatus(`${shortPlace(location.label)} selected.`);
    onChange(location);
  }

  function handleInputChange(text: string) {
    setQuery(text);
    setResults([]);
    setIsOpen(false);
    setLocationError(null);
    setStatus("");
    if (!value || text !== value.label) onChange(null);
  }

  function clear() {
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setActiveIndex(-1);
    setLocationError(null);
    setStatus("");
    onChange(null);
    inputRef.current?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (isOpen && activeIndex >= 0) select(results[activeIndex]);
      else void search();
      return;
    }
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (!isOpen || results.length === 0) return;

    const lastIndex = results.length - 1;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current < lastIndex ? current + 1 : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (current > 0 ? current - 1 : lastIndex));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(lastIndex);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by this browser.");
      return;
    }
    setIsLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const response = await fetch("/api/geocode/reverse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latitude: coords.latitude, longitude: coords.longitude }),
          });
          const data = await response.json();
          if (!response.ok || !data.success || !data.data.location) throw new Error();
          select(data.data.location);
          if (coords.accuracy > 250) {
            setLocationError(
              `Location is approximate (±${Math.round(coords.accuracy)} m). Search manually to refine it.`,
            );
          }
        } catch {
          setLocationError("Could not identify your location. Search manually instead.");
        } finally {
          setIsLocating(false);
        }
      },
      (geolocationError) => {
        setIsLocating(false);
        setLocationError(
          geolocationError.code === geolocationError.PERMISSION_DENIED
            ? "Location permission was denied. Search manually instead."
            : "Your current location is unavailable. Search manually instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  const displayError = error || locationError;
  const isPinned = Boolean(value) && query === value?.label;
  const describedBy = `${id}-help${displayError ? ` ${id}-error` : ""}`;

  return (
    <div ref={containerRef} className="relative min-w-0">
      <label htmlFor={`${id}-input`} className="field-label !mb-1.5">
        {label}
      </label>

      <div className="relative flex min-w-0 gap-2">
        <div className="relative min-w-0 flex-1">
          <MapPin
            className={`pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 ${
              isPinned ? "text-leaf" : "text-ink/35"
            }`}
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            id={`${id}-input`}
            className="text-field !min-h-12 !pr-10 !pl-10 text-sm placeholder:text-ink/35"
            placeholder={placeholder}
            value={query}
            onChange={(event) => handleInputChange(event.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => results.length && setIsOpen(true)}
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
            aria-autocomplete="none"
            aria-describedby={describedBy}
            aria-invalid={displayError ? true : undefined}
            aria-busy={isSearching || undefined}
            autoComplete="off"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={clear}
              className="absolute top-1/2 right-1.5 grid size-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-ink/6 hover:text-ink"
              aria-label={`Clear ${label.toLowerCase()}`}
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}

          {isOpen && results.length > 0 && (
            <ul
              id={listboxId}
              role="listbox"
              aria-label={`${label} results`}
              className="absolute top-full left-0 z-50 mt-1.5 max-h-[min(18rem,45svh)] w-full touch-pan-y overscroll-contain overflow-y-auto rounded-[1.1rem] border border-ink/12 bg-white py-1 shadow-[0_18px_45px_rgba(16,42,43,0.18)]"
            >
              {results.map((location, index) => (
                <li
                  key={`${location.coordinate.latitude}-${location.coordinate.longitude}-${index}`}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={`flex cursor-pointer items-start gap-2.5 px-3 py-2.5 ${
                    index === activeIndex ? "bg-ink text-paper" : "hover:bg-ink/6"
                  }`}
                  onClick={() => select(location)}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <MapPin
                    className={`mt-0.5 size-3.5 shrink-0 ${
                      index === activeIndex ? "text-mint" : "text-flame"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">
                      {shortPlace(location.label)}
                    </span>
                    {placeContext(location.label) && (
                      <span
                        className={`block truncate text-xs ${
                          index === activeIndex ? "text-paper/70" : "text-muted"
                        }`}
                      >
                        {placeContext(location.label)}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={() => void search()}
          className="grid size-12 shrink-0 place-items-center rounded-[0.85rem] bg-ink text-paper transition-colors hover:bg-accent disabled:opacity-50"
          disabled={isSearching}
          aria-label={`Search ${label.toLowerCase()}`}
        >
          {isSearching ? (
            <LoaderCircle className="size-4 motion-safe:animate-spin" aria-hidden="true" />
          ) : (
            <Search className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Announced only when the user has asked for something. */}
      <span role="status" aria-live="polite" className="sr-only">
        {status}
      </span>

      {isPinned && value && (
        <p className="mt-2 flex min-h-6 items-center gap-1.5 text-[0.68rem] font-bold text-leaf">
          <Check className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="numeric">
            Pinned · {formatCoordinate(value.coordinate.latitude, value.coordinate.longitude)}
          </span>
        </p>
      )}

      {showCurrentLocation && (
        <button
          type="button"
          className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-full px-2.5 text-[0.7rem] font-bold text-muted transition-colors hover:bg-ink/6 hover:text-ink disabled:opacity-40"
          onClick={useMyLocation}
          disabled={isLocating}
        >
          {isLocating ? (
            <LoaderCircle className="size-3.5 motion-safe:animate-spin" aria-hidden="true" />
          ) : (
            <Crosshair className="size-3.5" aria-hidden="true" />
          )}
          {isLocating ? "Finding you…" : "Use my current location"}
        </button>
      )}

      {/*
        Geoapify and OpenStreetMap attribution is a licence requirement wherever
        geocoded results are shown. It stays visible in every state.
      */}
      <span id={`${id}-help`} className="mt-1.5 block text-[0.62rem] leading-relaxed text-muted">
        {isPinned ? "Search again to change this location." : "Type a place, then press Search."}{" "}
        Geocoding by{" "}
        <a className="underline" href="https://www.geoapify.com/" target="_blank" rel="noreferrer">
          Geoapify
        </a>{" "}
        ©{" "}
        <a
          className="underline"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap contributors
        </a>
        .
      </span>

      {displayError && (
        <span id={`${id}-error`} role="alert" className="field-error">
          {displayError}
        </span>
      )}
    </div>
  );
}
