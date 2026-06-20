"use client";

import { useEffect, useState } from "react";

type Theme = "forest" | "twilight";

/** Light/Dark segmented toggle. Persists to localStorage; the anti-flash script in
 *  layout.tsx applies the saved value before first paint. */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("forest");

  // Sync from whatever the pre-paint script set on <html>.
  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: reads DOM once after mount to reconcile SSR default with pre-paint theme script; this is the canonical SSR-safe theme-sync pattern
    if (current === "twilight" || current === "forest") setTheme(current);
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    // eslint-disable-next-line react-hooks/immutability -- intentional: writing data-theme to <html> is the canonical DOM side-effect for SSR-safe theme toggling
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* storage may be unavailable; theme still applies for this session */
    }
  }

  const options: { value: Theme; label: string }[] = [
    { value: "forest", label: "Light" },
    { value: "twilight", label: "Dark" },
  ];

  return (
    <div className="inline-flex rounded-pill bg-pill p-1 gap-1" role="group" aria-label="Theme">
      {options.map((opt) => {
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => apply(opt.value)}
            aria-pressed={active}
            className={`rounded-pill px-4 py-1.5 text-sm font-semibold transition-colors ${
              active ? "bg-card text-ink shadow-sm" : "text-ink-soft hover:text-ink"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
