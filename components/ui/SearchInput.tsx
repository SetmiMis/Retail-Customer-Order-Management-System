'use client';

import { useRef, useState } from 'react';

export default function SearchInput({
  value, onChange, placeholder = 'Search…', debounceMs = 300, autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  debounceMs?: number;
  autoFocus?: boolean;
}) {
  const [local, setLocal] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Re-sync local state when the external value changes (e.g. cleared by a parent) — done during
  // render rather than in an effect, per React's guidance for adjusting state on a prop change.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setLocal(value);
  }

  function handleChange(v: string) {
    setLocal(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(v), debounceMs);
  }

  function clear() {
    setLocal('');
    if (timer.current) clearTimeout(timer.current);
    onChange('');
  }

  return (
    <div className="search-wrap">
      <span className="search-icon" aria-hidden>🔍</span>
      <input
        value={local}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label={placeholder}
      />
      {local && (
        <button className="search-clear" onClick={clear} aria-label="Clear search" type="button">✕</button>
      )}
    </div>
  );
}
