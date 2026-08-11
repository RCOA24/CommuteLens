"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { LocationIcon } from "@/components/ui/pill-button";
import type { Location } from "@/domain/models";

interface LocationSearchProps {
  /** Currently selected location (controlled). */
  value: Location | null;
  /** Called when the user picks a result or uses their location. */
  onChange: (location: Location) => void;
  /** Accessible label for the input. */
  label?: string;
  /** Placeholder text. */
  placeholder?: string;
  /** Optional error message to display. */
  error?: string | null;
  /** HTML id prefix for accessibility. */
  idPrefix?: string;
}

/**
 * Free-text location search with autocomplete suggestions from GET /api/geocode/search.
 * Includes a "Use My Location" button that requests browser geolocation only on click
 * and reverse-geocodes via GET /api/geocode/reverse.
 *
 * Does not log, store, or persist coordinates.
 */
export function LocationSearch({
  value,
  onChange,
  label = "WHERE YOU LIVE",
  placeholder = "Search a location...",
  error,
  idPrefix,
}: LocationSearchProps) {
  const generatedId = useId();
  const id = idPrefix ?? generatedId;

  const [query, setQuery] = useState(value?.label ?? "");
  const [results, setResults] = useState<Location[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const listboxId = `${id}-listbox`;

  // Close dropdown on outside click
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

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/geocode/search?q=${encodeURIComponent(q.trim())}`);
      const data = await response.json();
      if (data.success && data.data.results.length > 0) {
        setResults(data.data.results);
        setIsOpen(true);
        setActiveIndex(-1);
      } else {
        setResults([]);
        setIsOpen(false);
      }
    } catch {
      setResults([]);
      setIsOpen(false);
    } finally {
      setIsSearching(false);
    }
  }, []);

  function handleInputChange(text: string) {
    setQuery(text);
    setLocationError(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 300);
  }

  function handleSelect(location: Location) {
    setQuery(location.label);
    setResults([]);
    setIsOpen(false);
    setActiveIndex(-1);
    setLocationError(null);
    onChange(location);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (!isOpen || results.length === 0) return;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case "Enter":
        event.preventDefault();
        if (activeIndex >= 0 && activeIndex < results.length) {
          handleSelect(results[activeIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setActiveIndex(-1);
        break;
    }
  }

  async function handleUseMyLocation() {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const response = await fetch(
            `/api/geocode/reverse?lat=${latitude}&lon=${longitude}`,
          );
          const data = await response.json();
          if (data.success && data.data.location) {
            const location: Location = data.data.location;
            setQuery(location.label);
            onChange(location);
          } else {
            setLocationError("Could not identify your location.");
          }
        } catch {
          setLocationError("Reverse geocoding failed. Try searching manually.");
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setLocationError("Location permission denied.");
            break;
          case err.POSITION_UNAVAILABLE:
            setLocationError("Location unavailable.");
            break;
          case err.TIMEOUT:
            setLocationError("Location request timed out.");
            break;
          default:
            setLocationError("Could not get your location.");
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  const displayError = error || locationError;

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1.5 block text-[0.68rem] font-bold tracking-[0.14em] text-muted uppercase">
        {label}
      </label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            id={`${id}-input`}
            type="text"
            className="h-9 w-full rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-sm leading-tight text-ink placeholder:text-ink/35 focus:border-accent focus:outline-2 focus:outline-offset-1 focus:outline-accent"
            placeholder={placeholder}
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (results.length > 0) setIsOpen(true);
            }}
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
          />
          {isSearching && (
            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[0.65rem] text-muted">
              ...
            </span>
          )}
          {/* Dropdown results */}
          {isOpen && results.length > 0 && (
            <ul
              id={listboxId}
              role="listbox"
              className="absolute top-full left-0 z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-ink/10 bg-white shadow-lg"
            >
              {results.map((location, index) => (
                <li
                  key={`${location.coordinate.latitude}-${location.coordinate.longitude}-${index}`}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  className={`cursor-pointer px-3 py-2 text-sm ${
                    index === activeIndex ? "bg-ink/5 text-ink" : "text-ink/80 hover:bg-ink/5"
                  }`}
                  onMouseDown={() => handleSelect(location)}
                >
                  {location.label}
                </li>
              ))}
            </ul>
          )}
        </div>
        {/* Use My Location button */}
        <button
          type="button"
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-ink/15 bg-white px-2.5 text-[0.7rem] font-semibold text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
          onClick={handleUseMyLocation}
          disabled={isLocating}
          title="Use my current location"
          aria-label="Use my current location"
        >
          <LocationIcon />
          <span className="hidden sm:inline">{isLocating ? "Locating..." : "My Location"}</span>
        </button>
      </div>
      {displayError && (
        <span className="mt-1.5 block text-[0.78rem] font-semibold text-accent">
          {displayError}
        </span>
      )}
    </div>
  );
}
