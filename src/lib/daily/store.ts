import type { Cell } from "@/lib/nonogram";
import type { StreakState } from "./streak";

const KEY = "nonagarden.daily.v1";

export interface DailyToday {
  date: string;       // "YYYY-MM-DD"
  puzzleId: string;
  cells: Cell[][];    // serialized board for same-day resume
  completed: boolean;
  elapsedMs: number;  // frozen on completion
}

export interface DailyStore {
  version: 1;
  streak: StreakState;
  today: DailyToday | null;
}

export function defaultStore(): DailyStore {
  return { version: 1, streak: { current: 0, lastCompleted: null }, today: null };
}

function isStreak(v: unknown): v is StreakState {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.current === "number" &&
    (s.lastCompleted === null || typeof s.lastCompleted === "string")
  );
}

function isToday(v: unknown): v is DailyToday {
  if (v === null) return true;
  if (typeof v !== "object") return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.date === "string" &&
    typeof t.puzzleId === "string" &&
    Array.isArray(t.cells) &&
    typeof t.completed === "boolean" &&
    typeof t.elapsedMs === "number"
  );
}

function isStore(v: unknown): v is DailyStore {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return s.version === 1 && isStreak(s.streak) && isToday(s.today);
}

export function loadStore(): DailyStore {
  if (typeof window === "undefined") return defaultStore();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultStore();
    const parsed: unknown = JSON.parse(raw);
    return isStore(parsed) ? parsed : defaultStore();
  } catch {
    return defaultStore();
  }
}

export function saveStore(store: DailyStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // quota / privacy-mode — fail silently; daily still works in-memory.
  }
}
