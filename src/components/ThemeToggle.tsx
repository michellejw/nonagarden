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
    if (current === "twilight" || current === "forest") setTheme(current);
  }, []);

  function apply(next: Theme) {
    setTheme(next);
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
