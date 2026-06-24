import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";

export function AppHeader() {
  return (
    <header className="flex items-center justify-between border-b border-pill px-6 py-3">
      <Link href="/" className="text-sm font-semibold tracking-tight text-ink">
        Nonagarden
      </Link>
      <nav className="flex items-center gap-4">
        <Link href="/" className="text-sm font-semibold text-ink-soft hover:text-ink">
          Daily
        </Link>
        <Link
          href="/library"
          className="text-sm font-semibold text-ink-soft hover:text-ink"
        >
          Library
        </Link>
        <ThemeToggle />
      </nav>
    </header>
  );
}
