'use client';

import { useLayoutEffect, useState } from 'react';

// Initial value is read synchronously from the DOM rather than via an effect: the inline script in
// app/layout.tsx already applies the stored theme to <html> before hydration, so this just needs to
// agree with what's already there. suppressHydrationWarning covers the one render where the server
// (which has no localStorage) and client (which does) legitimately disagree.
function initialDark(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

export default function ThemeToggle() {
  const [dark, setDark] = useState(initialDark);

  // Dev-only safety net: React Strict Mode remounts once and resets <html> to only the attributes
  // JSX manages, clearing what the inline script set. Re-applying here is a no-op in production
  // (the attribute is already correct) — see preventing-flash-before-hydration.md.
  useLayoutEffect(() => {
    const stored = window.localStorage.getItem('fms-theme');
    if (stored) document.documentElement.setAttribute('data-theme', stored);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    window.localStorage.setItem('fms-theme', next ? 'dark' : 'light');
  }

  return (
    <button
      onClick={toggle}
      className={`themeToggle ${dark ? 'on' : ''}`}
      aria-label="Toggle dark mode"
      type="button"
      suppressHydrationWarning
    >
      {/* suppressHydrationWarning only covers one level deep — the parent button's attribute
          mismatch is covered above, but this icon text is a nested child and needs its own. */}
      <span className="knob" suppressHydrationWarning>{dark ? '🌙' : '☀'}</span>
    </button>
  );
}
