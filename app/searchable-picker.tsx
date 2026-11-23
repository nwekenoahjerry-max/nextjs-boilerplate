"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type SearchablePickerProps = {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
  showInitialOptions?: boolean;
  minimumQueryLength?: number;
  required?: boolean;
};

export default function SearchablePicker({
  label, value, options, placeholder, searchPlaceholder, emptyMessage, onChange,
  disabled = false, loading = false, showInitialOptions = false,
  minimumQueryLength = 2, required = false,
}: SearchablePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const normalizedQuery = query.trim().toLocaleLowerCase("en");
  const matchingOptions = useMemo(() => {
    if (!normalizedQuery) return showInitialOptions ? options.slice(0, 30) : [];
    if (normalizedQuery.length < minimumQueryLength) return [];
    return options.filter(option => option.toLocaleLowerCase("en").includes(normalizedQuery)).slice(0, 35);
  }, [minimumQueryLength, normalizedQuery, options, showInitialOptions]);
  const totalMatches = useMemo(() => {
    if (!normalizedQuery || normalizedQuery.length < minimumQueryLength) return options.length;
    return options.reduce((count, option) => count + (option.toLocaleLowerCase("en").includes(normalizedQuery) ? 1 : 0), 0);
  }, [minimumQueryLength, normalizedQuery, options]);

  const selectOption = (option: string) => {
    onChange(option);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="profile-search-picker" ref={rootRef}>
      <span className="profile-search-picker-label">{label} {required && <span className="required-mark">Required</span>}</span>
      <button
        type="button"
        className={`profile-search-picker-trigger${open ? " is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => { setOpen(current => !current); setQuery(""); }}
      >
        <span className={value ? "" : "picker-placeholder"}>{value || placeholder}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
      </button>
      {open && (
        <div className="profile-search-picker-panel">
          <input
            className="profile-search-picker-search"
            type="search"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={`Search ${label.toLowerCase()}`}
          />
          <div className="profile-search-picker-results" role="listbox" aria-label={`${label} options`}>
            {loading ? <p className="profile-search-picker-empty">Loading the university directory…</p>
              : matchingOptions.length > 0 ? matchingOptions.map(option => (
                <button
                  type="button"
                  role="option"
                  aria-selected={value === option}
                  className="profile-search-picker-option"
                  key={option}
                  onClick={() => selectOption(option)}
                >{option}</button>
              ))
              : !normalizedQuery && !showInitialOptions ? <p className="profile-search-picker-empty">Type at least {minimumQueryLength} letters to search {options.length.toLocaleString()} institutions.</p>
              : normalizedQuery.length < minimumQueryLength ? <p className="profile-search-picker-empty">Type at least {minimumQueryLength} letters to search.</p>
              : <p className="profile-search-picker-empty">{emptyMessage}</p>}
          </div>
          {!loading && matchingOptions.length > 0 && (totalMatches > matchingOptions.length || !normalizedQuery) && (
            <p className="profile-search-picker-footnote">{normalizedQuery ? `Showing ${matchingOptions.length} of ${totalMatches} matches. Refine your search to narrow the results.` : "Start typing to find any country in the directory."}</p>
          )}
        </div>
      )}
    </div>
  );
}
