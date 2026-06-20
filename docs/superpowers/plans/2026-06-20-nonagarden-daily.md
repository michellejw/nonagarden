# Nonagarden — Daily (Slice 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/` a deterministic daily nonogram — one puzzle per local calendar day, drawn from a bundled append-only list — with same-day board resume and a calendar-strict streak, all persisted in `localStorage`.

**Architecture:** A pure, clock-free logic layer (`src/lib/daily/`: schedule, streak, store, list) carries all the tricky behavior so it is exhaustively unit-tested. A thin UI layer (`src/features/daily/`) resolves "today" at the client edge, reuses the Slice-1 board engine (reducer + `Board`/`Cell`/`ClueLine`) for solving, and wraps it in a daily shell. The Slice-1 free-play screen is demoted to an unlinked `/play` dev harness.

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 + `@shroomgames/tokens`; Vitest + @testing-library/react + jsdom (already configured in Slice 1); pnpm.

## Global Constraints

- **"Today" = the player's LOCAL calendar date** as `"YYYY-MM-DD"` (rolls over at local midnight). Never UTC for "today."
- **`DAILY_LIST` is APPEND-ONLY.** Never insert or reorder entries — it retroactively rewrites past dailies. A pinning test guards this; never "fix" failures by editing the pins to match a reorder.
- **Date→puzzle is `list[index]`, never `hash % length`** — index-by-day is the past-stability guarantee.
- **All `src/lib/daily/` logic is pure and clock-free** except `store.ts` (touches `localStorage`). `Date` is read in exactly one place: `src/features/daily/todayDate.ts`.
- **No "free play" product feature.** Slice-1 `PlayScreen` survives only as an unlinked `/play` route.
- **localStorage key = `nonagarden.daily.v1`**; reads validate version + shape and fall back to defaults, never throw.
- **Streak = calendar-strict** (miss a calendar day → reset to 1 on next completion).
- TDD throughout. After every task: `pnpm test`, `pnpm typecheck`, `pnpm lint` green. Reuse existing tokens/components; add no new upstream token.
- Commit style: conventional commits (`feat:`, `test:`, `refactor:`, `chore:`).

---

## File Structure

```
src/lib/daily/
  list.ts        DAILY_EPOCH + DAILY_LIST (ordered, append-only puzzle ids)
  schedule.ts    daysSince(), dailyFor() — pure date→puzzle resolution
  streak.ts      completeDaily(), currentStreakAsOf() — pure streak transitions
  store.ts       DailyStore types + loadStore()/saveStore()/defaultStore() (localStorage)
  index.ts       barrel
  schedule.test.ts | streak.test.ts | store.test.ts | content.test.ts
src/features/daily/
  todayDate.ts   todayLocal() — the single Date edge
  DailyBoard.tsx drives the reused engine for one puzzle (no "New picture")
  DailyScreen.tsx the daily shell: skeleton/play/done/caught-up states, owns store+streak
  DailyScreen.test.tsx
src/features/play/
  reducer.ts     + seedState() (new export; existing behavior untouched)
  usePuzzleGame.ts + optional { initial, onChange } options arg (free-play unchanged)
  usePuzzleGame.test.ts (new)
src/lib/puzzles/builtins.ts   extend with ≥9 new verified puzzles
src/app/page.tsx              render <DailyScreen/> (replaces free-play)
src/app/play/page.tsx         new: unlinked dev harness rendering Slice-1 <PlayScreen/>
```

---

### Task 1: Daily schedule (pure date→puzzle resolution)

**Files:**
- Create: `src/lib/daily/list.ts`
- Create: `src/lib/daily/schedule.ts`
- Create: `src/lib/daily/index.ts`
- Test: `src/lib/daily/schedule.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces:
  - `DAILY_EPOCH: string` (`"2026-06-22"`), `DAILY_LIST: readonly string[]`
  - `daysSince(epoch: string, date: string): number`
  - `type DailyResult = { kind: "puzzle"; puzzleId: string; index: number } | { kind: "before-epoch" } | { kind: "none" }`
  - `dailyFor(date: string, list?: readonly string[], epoch?: string): DailyResult`

- [ ] **Step 1: Write the failing test**

`src/lib/daily/schedule.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { daysSince, dailyFor } from "./schedule";
import { DAILY_EPOCH } from "./list";

const LIST = ["a", "b", "c"];

describe("daysSince", () => {
  it("is 0 for the same date", () => {
    expect(daysSince("2026-06-22", "2026-06-22")).toBe(0);
  });
  it("counts whole calendar days forward", () => {
    expect(daysSince("2026-06-22", "2026-06-25")).toBe(3);
  });
  it("is negative before the epoch", () => {
    expect(daysSince("2026-06-22", "2026-06-21")).toBe(-1);
  });
  it("counts correctly across a US DST spring-forward (2026-03-08)", () => {
    expect(daysSince("2026-03-07", "2026-03-09")).toBe(2);
  });
  it("counts correctly across a fall-back (2026-11-01)", () => {
    expect(daysSince("2026-10-31", "2026-11-02")).toBe(2);
  });
});

describe("dailyFor", () => {
  it("maps the epoch day to index 0", () => {
    expect(dailyFor("2026-06-22", LIST, "2026-06-22")).toEqual({
      kind: "puzzle", puzzleId: "a", index: 0,
    });
  });
  it("walks the list by day offset", () => {
    expect(dailyFor("2026-06-24", LIST, "2026-06-22")).toEqual({
      kind: "puzzle", puzzleId: "c", index: 2,
    });
  });
  it("returns before-epoch for earlier dates", () => {
    expect(dailyFor("2026-06-21", LIST, "2026-06-22")).toEqual({ kind: "before-epoch" });
  });
  it("returns none once it runs off the end", () => {
    expect(dailyFor("2026-06-25", LIST, "2026-06-22")).toEqual({ kind: "none" });
  });
  it("defaults to the real DAILY_LIST + DAILY_EPOCH", () => {
    expect(dailyFor(DAILY_EPOCH).kind).toBe("puzzle");
  });
  // PINNING TEST — guards append-only. If this fails after editing DAILY_LIST,
  // you reordered/inserted instead of appending. Fix the list, not these pins.
  it("pins historical (date -> puzzleId) so reorders fail CI", () => {
    expect(dailyFor("2026-06-22")).toMatchObject({ index: 0, puzzleId: "sprout" });
    expect(dailyFor("2026-06-23")).toMatchObject({ index: 1, puzzleId: "diamond" });
    expect(dailyFor("2026-06-24")).toMatchObject({ index: 2, puzzleId: "toadstool" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/lib/daily/schedule.test.ts`
Expected: FAIL — cannot resolve `./schedule` / `./list`.

- [ ] **Step 3: Write the list**

`src/lib/daily/list.ts`:
```ts
// The daily schedule. DAILY_LIST is APPEND-ONLY: dailyFor() maps day N (since
// DAILY_EPOCH) to DAILY_LIST[N], so inserting or reordering any entry
// retroactively changes past dailies (breaking streaks + the future archive).
// To add content: append ids to the END only. Every id must exist in BUILTINS.
export const DAILY_EPOCH = "2026-06-22"; // day 0 — the first-ever daily

export const DAILY_LIST: readonly string[] = [
  "sprout",
  "diamond",
  "toadstool",
  "heart",
  "cottage",
  // Task 4 appends ≥9 more here.
];
```

- [ ] **Step 4: Write the schedule resolver**

`src/lib/daily/schedule.ts`:
```ts
import { DAILY_EPOCH, DAILY_LIST } from "./list";

// Parse "YYYY-MM-DD" to a UTC-noon timestamp. Noon avoids any DST/offset
// landing math on a different calendar day, so whole-day diffs are exact.
function toUtcNoon(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 12);
}

export function daysSince(epoch: string, date: string): number {
  return Math.round((toUtcNoon(date) - toUtcNoon(epoch)) / 86_400_000);
}

export type DailyResult =
  | { kind: "puzzle"; puzzleId: string; index: number }
  | { kind: "before-epoch" }
  | { kind: "none" };

export function dailyFor(
  date: string,
  list: readonly string[] = DAILY_LIST,
  epoch: string = DAILY_EPOCH,
): DailyResult {
  const index = daysSince(epoch, date);
  if (index < 0) return { kind: "before-epoch" };
  if (index >= list.length) return { kind: "none" };
  return { kind: "puzzle", puzzleId: list[index], index };
}
```

`src/lib/daily/index.ts`:
```ts
export * from "./list";
export * from "./schedule";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test -- src/lib/daily/schedule.test.ts`
Expected: PASS (all cases).

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm typecheck`
```bash
git add src/lib/daily/list.ts src/lib/daily/schedule.ts src/lib/daily/index.ts src/lib/daily/schedule.test.ts
git commit -m "feat: add deterministic daily schedule (date->puzzle)"
```

---

### Task 2: Streak logic (pure, calendar-strict)

**Files:**
- Create: `src/lib/daily/streak.ts`
- Modify: `src/lib/daily/index.ts` (add `export * from "./streak";`)
- Test: `src/lib/daily/streak.test.ts`

**Interfaces:**
- Consumes: `daysSince` from `./schedule`.
- Produces:
  - `interface StreakState { current: number; lastCompleted: string | null }`
  - `completeDaily(prev: StreakState, date: string): StreakState`
  - `currentStreakAsOf(state: StreakState, today: string): number`

- [ ] **Step 1: Write the failing test**

`src/lib/daily/streak.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { completeDaily, currentStreakAsOf, type StreakState } from "./streak";

const fresh: StreakState = { current: 0, lastCompleted: null };

describe("completeDaily", () => {
  it("starts a streak at 1 from nothing", () => {
    expect(completeDaily(fresh, "2026-06-22")).toEqual({ current: 1, lastCompleted: "2026-06-22" });
  });
  it("increments on a consecutive day", () => {
    const a = completeDaily(fresh, "2026-06-22");
    expect(completeDaily(a, "2026-06-23")).toEqual({ current: 2, lastCompleted: "2026-06-23" });
  });
  it("is idempotent when completing the same day twice", () => {
    const a = completeDaily(fresh, "2026-06-22");
    expect(completeDaily(a, "2026-06-22")).toEqual(a);
  });
  it("resets to 1 after a missed day (gap > 1)", () => {
    const a = { current: 5, lastCompleted: "2026-06-22" };
    expect(completeDaily(a, "2026-06-24")).toEqual({ current: 1, lastCompleted: "2026-06-24" });
  });
});

describe("currentStreakAsOf", () => {
  it("is 0 with no history", () => {
    expect(currentStreakAsOf(fresh, "2026-06-22")).toBe(0);
  });
  it("shows the streak on the completed day", () => {
    expect(currentStreakAsOf({ current: 3, lastCompleted: "2026-06-22" }, "2026-06-22")).toBe(3);
  });
  it("still shows the streak the day after (not yet broken)", () => {
    expect(currentStreakAsOf({ current: 3, lastCompleted: "2026-06-22" }, "2026-06-23")).toBe(3);
  });
  it("reads as broken (0) once a day is missed", () => {
    expect(currentStreakAsOf({ current: 3, lastCompleted: "2026-06-22" }, "2026-06-24")).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/lib/daily/streak.test.ts`
Expected: FAIL — cannot resolve `./streak`.

- [ ] **Step 3: Write the implementation**

`src/lib/daily/streak.ts`:
```ts
import { daysSince } from "./schedule";

export interface StreakState {
  current: number;
  lastCompleted: string | null; // "YYYY-MM-DD"
}

// Pure transition: completing `date` given prior state. Calendar-strict.
export function completeDaily(prev: StreakState, date: string): StreakState {
  if (prev.lastCompleted === date) return prev; // idempotent
  if (prev.lastCompleted && daysSince(prev.lastCompleted, date) === 1) {
    return { current: prev.current + 1, lastCompleted: date };
  }
  return { current: 1, lastCompleted: date }; // first ever, or after a gap
}

// Display-only: the streak as it reads "today" without mutating stored state.
// Breaks to 0 as soon as a calendar day is missed.
export function currentStreakAsOf(state: StreakState, today: string): number {
  if (!state.lastCompleted) return 0;
  const gap = daysSince(state.lastCompleted, today);
  return gap === 0 || gap === 1 ? state.current : 0;
}
```

`src/lib/daily/index.ts` — append:
```ts
export * from "./streak";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/lib/daily/streak.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm typecheck`
```bash
git add src/lib/daily/streak.ts src/lib/daily/index.ts src/lib/daily/streak.test.ts
git commit -m "feat: add calendar-strict streak logic"
```

---

### Task 3: Persistence store (versioned, SSR-safe)

**Files:**
- Create: `src/lib/daily/store.ts`
- Modify: `src/lib/daily/index.ts` (add `export * from "./store";`)
- Test: `src/lib/daily/store.test.ts`

**Interfaces:**
- Consumes: `StreakState` from `./streak`; `Cell` from `@/lib/nonogram`.
- Produces:
  - `interface DailyToday { date: string; puzzleId: string; cells: Cell[][]; completed: boolean; elapsedMs: number }`
  - `interface DailyStore { version: 1; streak: StreakState; today: DailyToday | null }`
  - `defaultStore(): DailyStore`
  - `loadStore(): DailyStore`
  - `saveStore(store: DailyStore): void`

- [ ] **Step 1: Write the failing test**

`src/lib/daily/store.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { loadStore, saveStore, defaultStore, type DailyStore } from "./store";

const KEY = "nonagarden.daily.v1";

beforeEach(() => {
  window.localStorage.clear();
});

describe("daily store", () => {
  it("returns defaults when nothing is stored", () => {
    expect(loadStore()).toEqual(defaultStore());
  });
  it("round-trips a saved store", () => {
    const s: DailyStore = {
      version: 1,
      streak: { current: 4, lastCompleted: "2026-06-25" },
      today: { date: "2026-06-25", puzzleId: "sprout", cells: [[1, 0]], completed: false, elapsedMs: 1234 },
    };
    saveStore(s);
    expect(loadStore()).toEqual(s);
  });
  it("falls back to defaults on malformed JSON (never throws)", () => {
    window.localStorage.setItem(KEY, "{not json");
    expect(loadStore()).toEqual(defaultStore());
  });
  it("falls back to defaults on a wrong/old version", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ version: 99, streak: {}, today: null }));
    expect(loadStore()).toEqual(defaultStore());
  });
  it("falls back to defaults on a shape mismatch", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ version: 1, streak: "nope", today: null }));
    expect(loadStore()).toEqual(defaultStore());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/lib/daily/store.test.ts`
Expected: FAIL — cannot resolve `./store`.

- [ ] **Step 3: Write the implementation**

`src/lib/daily/store.ts`:
```ts
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
```

`src/lib/daily/index.ts` — append:
```ts
export * from "./store";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/lib/daily/store.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm typecheck`
```bash
git add src/lib/daily/store.ts src/lib/daily/index.ts src/lib/daily/store.test.ts
git commit -m "feat: add versioned, SSR-safe daily localStorage store"
```

---

### Task 4: Seed daily content (≥9 new verified puzzles)

Grow the bundled pool so the daily has ≈2 weeks of runway, and assert every scheduled id resolves to a real, unique, line-solvable puzzle. **The integrity test is the quality gate**: author candidate pictures, run the test, keep only those that pass.

**Files:**
- Modify: `src/lib/puzzles/builtins.ts` (append new puzzles)
- Modify: `src/lib/daily/list.ts` (append the new ids — END only)
- Test: `src/lib/daily/content.test.ts`

**Interfaces:**
- Consumes: `BUILTINS` from `@/lib/puzzles/builtins`; `DAILY_LIST` from `./list`; `cluesFor`, `lineSolve`, `countSolutions`, `difficultyOf` from `@/lib/nonogram`.
- Produces: a longer `DAILY_LIST` (length ≥ 14) and `BUILTINS`; no new exported symbols.

- [ ] **Step 1: Write the failing integrity test**

`src/lib/daily/content.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { DAILY_LIST } from "./list";
import { BUILTINS } from "@/lib/puzzles/builtins";
import { cluesFor, lineSolve, countSolutions, difficultyOf } from "@/lib/nonogram";

const byId = new Map(BUILTINS.map((p) => [p.id, p]));

describe("daily content integrity", () => {
  it("has at least 14 days of runway", () => {
    expect(DAILY_LIST.length).toBeGreaterThanOrEqual(14);
  });

  it("references only real puzzles, with no duplicate ids in the schedule", () => {
    for (const id of DAILY_LIST) expect(byId.has(id)).toBe(true);
    expect(new Set(DAILY_LIST).size).toBe(DAILY_LIST.length);
  });

  it("every scheduled puzzle is unique and line-solvable (no guessing)", () => {
    for (const id of DAILY_LIST) {
      const p = byId.get(id)!;
      const { rowClues, colClues } = cluesFor(p);
      const solved = lineSolve(rowClues, colClues, p.size);
      expect(solved.solved, `${id} must be line-solvable`).toBe(true);
      const count = countSolutions(rowClues, colClues, p.size, 2);
      expect(count, `${id} must have exactly one solution`).toEqual({ status: "ok", count: 1 });
    }
  });

  it("grades every scheduled puzzle (forager/woodlander/mycologist)", () => {
    for (const id of DAILY_LIST) {
      const p = byId.get(id)!;
      const { rowClues, colClues } = cluesFor(p);
      expect(["forager", "woodlander", "mycologist"]).toContain(
        difficultyOf(rowClues, colClues, p.size),
      );
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/lib/daily/content.test.ts`
Expected: FAIL — `DAILY_LIST.length` is 5 (< 14).

- [ ] **Step 3: Author candidate puzzles, gating each with the solver**

Append new `Puzzle` objects to `BUILTINS` in `src/lib/puzzles/builtins.ts`. Author a mix of 5×5 and 10×10 cozy pictures (mushrooms, leaves, snail, acorn, bee, flower, raindrop, star, fish, etc.). For **each** candidate, verify uniqueness + line-solvability before keeping it. Use this throwaway check (run, then delete) to iterate quickly:

`src/lib/daily/_candidate_check.test.ts` (temporary — delete before commit):
```ts
import { it } from "vitest";
import { cluesFor, lineSolve, countSolutions, difficultyOf } from "@/lib/nonogram";

it("inspect a candidate", () => {
  const candidate = { id: "snail", name: "Snail", size: 5, rows: [
    ".....",
    ".###.",
    "#.#.#",
    "#.###",
    ".#...",
  ] };
  const { rowClues, colClues } = cluesFor(candidate);
  // eslint-disable-next-line no-console
  console.log(candidate.id,
    "line-solvable:", lineSolve(rowClues, colClues, candidate.size).solved,
    "solutions:", countSolutions(rowClues, colClues, candidate.size, 2),
    "difficulty:", difficultyOf(rowClues, colClues, candidate.size));
});
```
Run `pnpm test -- src/lib/daily/_candidate_check.test.ts` and read the console output. Keep a candidate only if `line-solvable: true` and `solutions: { status: "ok", count: 1 }`. If a picture isn't unique, nudge a few cells (asymmetry usually fixes it) and re-check. Repeat until you have **≥9 keepers**. Delete `_candidate_check.test.ts` when done.

Each kept puzzle is appended to `BUILTINS` like the existing entries:
```ts
{
  id: "snail",
  name: "Snail",
  size: 5,
  rows: [".........."], // ← the verified rows for this picture
},
```

- [ ] **Step 4: Append the new ids to the daily schedule (END only)**

In `src/lib/daily/list.ts`, append the kept ids after `"cottage"` so `DAILY_LIST.length >= 14`. **Do not reorder the existing five** (the pinning test in Task 1 enforces this):
```ts
export const DAILY_LIST: readonly string[] = [
  "sprout", "diamond", "toadstool", "heart", "cottage",
  "snail", /* …≥9 new ids… */
];
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test -- src/lib/daily/content.test.ts src/lib/daily/schedule.test.ts src/lib/puzzles/builtins.test.ts`
Expected: PASS (integrity gate + pinning + existing builtins suite). Confirm `_candidate_check.test.ts` is deleted (`ls src/lib/daily/` shows no such file).

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm typecheck`
```bash
git add src/lib/puzzles/builtins.ts src/lib/daily/list.ts src/lib/daily/content.test.ts
git commit -m "feat: seed daily pool with verified puzzles (>=14 days runway)"
```

---

### Task 5: Resume/persist seam on `usePuzzleGame`

Add an optional options arg so a board can be **seeded** from saved cells and **observed** for persistence. Free-play (`usePuzzleGame(BUILTINS)`) must behave exactly as before.

**Files:**
- Modify: `src/features/play/reducer.ts` (add `seedState` export; existing code untouched)
- Modify: `src/features/play/usePuzzleGame.ts` (add optional 2nd arg)
- Test: `src/features/play/usePuzzleGame.test.ts`

**Interfaces:**
- Consumes: existing `reducer`, `initState`, `PlayState`, `PlayApi`.
- Produces:
  - `seedState(puzzle: Puzzle, saved: { cells: Grid; won: boolean; frozenElapsed: number }): PlayState`
  - `interface PuzzleGameOptions { initial?: { cells: Grid; won: boolean; frozenElapsed: number }; onChange?: (snap: { cells: Grid; won: boolean; frozenElapsed: number }) => void }`
  - `usePuzzleGame(puzzles: Puzzle[], opts?: PuzzleGameOptions): PlayApi`

- [ ] **Step 1: Write the failing test**

`src/features/play/usePuzzleGame.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePuzzleGame } from "./usePuzzleGame";
import type { Puzzle } from "@/lib/nonogram";

const P: Puzzle = { id: "t", name: "Tee", size: 2, rows: ["##", ".#"] };

describe("usePuzzleGame options", () => {
  it("with no options, starts from an empty board (unchanged behavior)", () => {
    const { result } = renderHook(() => usePuzzleGame([P]));
    expect(result.current.cells).toEqual([[0, 0], [0, 0]]);
    expect(result.current.won).toBe(false);
  });

  it("seeds the board from opts.initial", () => {
    const { result } = renderHook(() =>
      usePuzzleGame([P], { initial: { cells: [[1, 0], [0, 1]], won: false, frozenElapsed: 0 } }),
    );
    expect(result.current.cells).toEqual([[1, 0], [0, 1]]);
  });

  it("restores a completed board (won + frozen time)", () => {
    const { result } = renderHook(() =>
      usePuzzleGame([P], { initial: { cells: [[1, 1], [0, 1]], won: true, frozenElapsed: 5000 } }),
    );
    expect(result.current.won).toBe(true);
    expect(result.current.elapsedMs).toBe(5000);
  });

  it("calls onChange with a snapshot when the board changes", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => usePuzzleGame([P], { onChange }));
    act(() => result.current.paint(0, 0, 1));
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls.at(-1)![0];
    expect(last.cells[0][0]).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/features/play/usePuzzleGame.test.ts`
Expected: FAIL — `usePuzzleGame` ignores options / `initial` not applied.

- [ ] **Step 3: Add `seedState` to the reducer**

In `src/features/play/reducer.ts`, add (do not change existing functions):
```ts
export function seedState(
  puzzle: Puzzle,
  saved: { cells: Grid; won: boolean; frozenElapsed: number },
): PlayState {
  return {
    index: 0,
    puzzle,
    cells: saved.cells.map((row) => row.slice()) as Grid,
    mode: "fill",
    startTs: null,
    won: saved.won,
    frozenElapsed: saved.frozenElapsed,
  };
}
```

- [ ] **Step 4: Thread options through `usePuzzleGame`**

In `src/features/play/usePuzzleGame.ts`:
- add `import { useRef } from "react"` to the existing React import;
- import `seedState`: `import { reducer, initState, seedState, type Mode } from "./reducer";`
- add the options type above the hook:
```ts
export interface PuzzleGameSnapshot {
  cells: Cell[][];
  won: boolean;
  frozenElapsed: number;
}
export interface PuzzleGameOptions {
  initial?: PuzzleGameSnapshot;
  onChange?: (snap: PuzzleGameSnapshot) => void;
}
```
- change the signature and the reducer init:
```ts
export function usePuzzleGame(puzzles: Puzzle[], opts?: PuzzleGameOptions): PlayApi {
  const [state, dispatch] = useReducer(
    reducer,
    null,
    () => (opts?.initial ? seedState(puzzles[0], opts.initial) : initState(puzzles)),
  );
```
- add a persistence effect (latest `onChange` via ref so it isn't a dep), right after the existing timer `useEffect`:
```ts
  const onChangeRef = useRef(opts?.onChange);
  onChangeRef.current = opts?.onChange;
  useEffect(() => {
    onChangeRef.current?.({
      cells: state.cells,
      won: state.won,
      frozenElapsed: state.frozenElapsed,
    });
  }, [state.cells, state.won, state.frozenElapsed]);
```

- [ ] **Step 5: Run the full play + new suite to verify pass + no regression**

Run: `pnpm test -- src/features/play`
Expected: PASS — the new options test **and** all existing play tests (`reducer.test.ts`, `PlayScreen.test.tsx`, etc.) stay green.

- [ ] **Step 6: Typecheck + lint + commit**

Run: `pnpm typecheck && pnpm lint`
```bash
git add src/features/play/reducer.ts src/features/play/usePuzzleGame.ts src/features/play/usePuzzleGame.test.ts
git commit -m "feat: add resume/persist options to usePuzzleGame"
```

---

### Task 6: `todayLocal()` + `DailyBoard`

The single `Date` edge, plus a component that drives the reused engine for one puzzle (no "New picture").

> **Accepted simplification (resume timer):** in-progress resume restores the *board cells* (the thing you'd hate to lose) but the active timer restarts for the new session (`startTs: null` in `seedState`). A completed board restores its frozen time exactly. Precise cross-session active-time accounting is out of scope for this slice.

**Files:**
- Create: `src/features/daily/todayDate.ts`
- Create: `src/features/daily/DailyBoard.tsx`

**Interfaces:**
- Consumes: `usePuzzleGame`, `PuzzleGameSnapshot` from `@/features/play/usePuzzleGame`; `Board` from `@/features/play/Board`; `formatTime` from `@/features/play/format`; `Puzzle` from `@/lib/nonogram`.
- Produces:
  - `todayLocal(d?: Date): string`
  - `<DailyBoard puzzle={Puzzle} initial?={PuzzleGameSnapshot} onChange={(s: PuzzleGameSnapshot) => void} onWin={() => void} />`

- [ ] **Step 1: Write the failing test for `todayLocal`**

`src/features/daily/todayDate.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { todayLocal } from "./todayDate";

describe("todayLocal", () => {
  it("formats a date as local YYYY-MM-DD with zero-padding", () => {
    expect(todayLocal(new Date(2026, 0, 5))).toBe("2026-01-05"); // Jan 5 2026, local
  });
  it("uses local calendar parts (not UTC)", () => {
    const d = new Date(2026, 5, 22, 23, 30); // local 11:30pm Jun 22
    expect(todayLocal(d)).toBe("2026-06-22");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/features/daily/todayDate.test.ts`
Expected: FAIL — cannot resolve `./todayDate`.

- [ ] **Step 3: Implement `todayLocal`**

`src/features/daily/todayDate.ts`:
```ts
// The ONLY place "today" is read from the clock. Uses LOCAL calendar parts so
// the daily rolls over at the player's local midnight.
export function todayLocal(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/features/daily/todayDate.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement `DailyBoard`** (no separate unit test — exercised via `DailyScreen` in Task 7)

`src/features/daily/DailyBoard.tsx`:
```tsx
"use client";

import { useEffect, useRef } from "react";
import type { Puzzle } from "@/lib/nonogram";
import { usePuzzleGame, type PuzzleGameSnapshot } from "@/features/play/usePuzzleGame";
import { Board } from "@/features/play/Board";
import { formatTime } from "@/features/play/format";
import type { Mode } from "@/features/play/reducer";

const MODES: { value: Mode; label: string }[] = [
  { value: "fill", label: "Fill" },
  { value: "mark", label: "Mark" },
];

export function DailyBoard({
  puzzle,
  initial,
  onChange,
  onWin,
}: {
  puzzle: Puzzle;
  initial?: PuzzleGameSnapshot;
  onChange: (snap: PuzzleGameSnapshot) => void;
  onWin: () => void;
}) {
  const game = usePuzzleGame([puzzle], { initial, onChange });

  // Fire onWin once when the board transitions to solved (idempotent upstream).
  const firedRef = useRef(false);
  useEffect(() => {
    if (game.won && !firedRef.current) {
      firedRef.current = true;
      onWin();
    }
  }, [game.won, onWin]);

  const conflictLines = [
    ...game.rowState.flatMap((s, i) => (s === "impossible" ? [`row ${i + 1}`] : [])),
    ...game.colState.flatMap((s, i) => (s === "impossible" ? [`column ${i + 1}`] : [])),
  ];
  const liveMessage = game.won
    ? `Picture complete — it's a ${game.puzzle.name.toLowerCase()}, solved in ${formatTime(game.elapsedMs)}.`
    : conflictLines.length > 0
      ? `${conflictLines.join(", ").replace(/^./, (c) => c.toUpperCase())} can't be satisfied yet.`
      : "";

  return (
    <div className="w-fit">
      <Board
        size={game.puzzle.size}
        cells={game.cells}
        rowClues={game.rowClues}
        colClues={game.colClues}
        rowState={game.rowState}
        colState={game.colState}
        primaryValueAt={game.primaryValueAt}
        markValueAt={game.markValueAt}
        paint={game.paint}
      />
      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="inline-flex rounded-pill bg-pill p-1" role="group" aria-label="Tool">
          {MODES.map((m) => {
            const active = game.mode === m.value;
            return (
              <button
                key={m.value}
                type="button"
                aria-pressed={active}
                onClick={() => game.setMode(m.value)}
                className={`rounded-pill px-4 py-1.5 text-sm font-semibold transition-colors ${
                  active ? "bg-card text-ink shadow-sm" : "text-ink-soft hover:text-ink"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={game.reset}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-ink-soft hover:text-ink"
        >
          Reset
        </button>
      </div>

      {game.won && (
        <div className="mt-4 rounded-2xl bg-card p-5" style={{ animation: "ng-rise .35s ease-out" }}>
          <h2 className="text-2xl font-semibold text-ink">Picture complete!</h2>
          <p className="mt-1 text-sm text-ink-soft">
            It&apos;s a {game.puzzle.name.toLowerCase()} — solved in {formatTime(game.elapsedMs)}.
          </p>
          <p className="mt-3 text-sm font-semibold text-ink">Come back tomorrow 🌱</p>
          {/* Slice #5 adds a "play a past daily" control in the space below. */}
        </div>
      )}

      <div role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck + commit**

Run: `pnpm typecheck`
```bash
git add src/features/daily/todayDate.ts src/features/daily/todayDate.test.ts src/features/daily/DailyBoard.tsx
git commit -m "feat: add todayLocal + DailyBoard (single-puzzle daily engine)"
```

---

### Task 7: `DailyScreen` shell (states + streak ownership)

Owns the store, resolves "today" after mount, renders skeleton → play/done/caught-up, and applies streak on win.

**Files:**
- Create: `src/features/daily/DailyScreen.tsx`
- Test: `src/features/daily/DailyScreen.test.tsx`

**Interfaces:**
- Consumes: `dailyFor` (`@/lib/daily`), `completeDaily`, `currentStreakAsOf`, `loadStore`, `saveStore`, `defaultStore`, `DailyStore` (`@/lib/daily`); `todayLocal` (`./todayDate`); `DailyBoard` (`./DailyBoard`); `BUILTINS` (`@/lib/puzzles/builtins`); `ThemeToggle`; `formatTime`.
- Produces: `<DailyScreen nowDate?={string} />` (the `nowDate` prop overrides the clock in tests).

- [ ] **Step 1: Write the failing test**

`src/features/daily/DailyScreen.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { DailyScreen } from "./DailyScreen";
import { saveStore, type DailyStore } from "@/lib/daily";

// 2026-06-22 is DAILY_EPOCH → index 0 → "sprout" (5x5). Its solution rows:
const SPROUT_FILLS: [number, number][] = [];
const SPROUT_ROWS = ["..#..", "..#..", "#.#.#", ".###.", "..#.."];
SPROUT_ROWS.forEach((row, r) =>
  row.split("").forEach((ch, c) => { if (ch === "#") SPROUT_FILLS.push([r, c]); }),
);

beforeEach(() => window.localStorage.clear());

describe("DailyScreen", () => {
  it("renders today's puzzle name-free header with the date", async () => {
    render(<DailyScreen nowDate="2026-06-22" />);
    expect(await screen.findByText(/June 22/)).toBeInTheDocument();
    // a grid is shown (DailyBoard mounted)
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });

  it("shows the caught-up state past the end of the schedule", async () => {
    render(<DailyScreen nowDate="2099-01-01" />);
    expect(await screen.findByText(/caught up/i)).toBeInTheDocument();
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("solving the daily shows the done card and increments the streak", async () => {
    render(<DailyScreen nowDate="2026-06-22" />);
    await screen.findByRole("grid");
    const grid = screen.getByRole("grid");
    for (const [r, c] of SPROUT_FILLS) {
      fireEvent.pointerDown(within(grid).getByLabelText(new RegExp(`Row ${r + 1}, column ${c + 1}`, "i")));
    }
    expect(await screen.findByText(/Picture complete/i)).toBeInTheDocument();
    expect(screen.getByText(/come back tomorrow/i)).toBeInTheDocument();
    expect(screen.getByText(/1 day streak/i)).toBeInTheDocument();
  });

  it("restores a completed-today board as done on load (no re-offer)", async () => {
    const done: DailyStore = {
      version: 1,
      streak: { current: 1, lastCompleted: "2026-06-22" },
      today: { date: "2026-06-22", puzzleId: "sprout", cells:
        SPROUT_ROWS.map((row) => row.split("").map((ch) => (ch === "#" ? 1 : 0))),
        completed: true, elapsedMs: 4000 },
    };
    saveStore(done);
    render(<DailyScreen nowDate="2026-06-22" />);
    expect(await screen.findByText(/Picture complete/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/features/daily/DailyScreen.test.tsx`
Expected: FAIL — cannot resolve `./DailyScreen`.

- [ ] **Step 3: Implement `DailyScreen`**

`src/features/daily/DailyScreen.tsx`:
```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  dailyFor,
  completeDaily,
  currentStreakAsOf,
  loadStore,
  saveStore,
  defaultStore,
  type DailyStore,
} from "@/lib/daily";
import { BUILTINS } from "@/lib/puzzles/builtins";
import { ThemeToggle } from "@/components/ThemeToggle";
import { todayLocal } from "./todayDate";
import { DailyBoard } from "./DailyBoard";
import type { PuzzleGameSnapshot } from "@/features/play/usePuzzleGame";

const byId = new Map(BUILTINS.map((p) => [p.id, p]));

function formatLongDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function DailyScreen({ nowDate }: { nowDate?: string }) {
  const [today, setToday] = useState<string | null>(nowDate ?? null);
  const [store, setStore] = useState<DailyStore>(defaultStore);

  // Resolve clock + storage only on the client, after mount (avoids hydration
  // mismatch: the server can't know the player's local date or localStorage).
  useEffect(() => {
    setStore(loadStore());
    setToday(nowDate ?? todayLocal());
  }, [nowDate]);

  const result = useMemo(() => (today ? dailyFor(today) : null), [today]);
  const streak = today ? currentStreakAsOf(store.streak, today) : 0;

  if (!today || !result) return <DailyShell streak={0} dateLabel="" />; // skeleton

  if (result.kind === "puzzle") {
    const puzzle = byId.get(result.puzzleId);
    if (puzzle) {
      const saved =
        store.today && store.today.date === today && store.today.puzzleId === puzzle.id
          ? { cells: store.today.cells, won: store.today.completed, frozenElapsed: store.today.elapsedMs }
          : undefined;

      const persist = (snap: PuzzleGameSnapshot) =>
        setStore((s) => {
          const next: DailyStore = {
            ...s,
            today: {
              date: today,
              puzzleId: puzzle.id,
              cells: snap.cells,
              completed: snap.won,
              elapsedMs: snap.frozenElapsed,
            },
          };
          saveStore(next);
          return next;
        });

      const onWin = () =>
        setStore((s) => {
          const next: DailyStore = { ...s, streak: completeDaily(s.streak, today) };
          saveStore(next);
          return next;
        });

      return (
        <DailyShell streak={streak} dateLabel={formatLongDate(today)}>
          <DailyBoard puzzle={puzzle} initial={saved} onChange={persist} onWin={onWin} />
        </DailyShell>
      );
    }
  }

  // none / before-epoch / missing puzzle → caught-up copy.
  return (
    <DailyShell streak={streak} dateLabel={formatLongDate(today)}>
      <div className="rounded-2xl bg-card p-6 text-center">
        <h2 className="text-xl font-semibold text-ink">You&apos;re all caught up</h2>
        <p className="mt-2 text-sm text-ink-soft">No daily scheduled yet — come back soon 🌱</p>
      </div>
    </DailyShell>
  );
}

function DailyShell({
  streak,
  dateLabel,
  children,
}: {
  streak: number;
  dateLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-fit">
        <div className="mb-5 flex items-start justify-between gap-7">
          <div className="flex flex-col gap-[3px]">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[1.3px] text-ink-soft">
              Daily
            </span>
            <span className="text-[1.75rem] font-semibold leading-none text-ink">
              {dateLabel || " "}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {streak > 0 && (
              <div
                className="inline-flex items-center rounded-pill bg-pill px-[15px] py-[9px] text-sm font-semibold text-ink"
                aria-label={`Current streak: ${streak} ${streak === 1 ? "day" : "days"}`}
              >
                🔥 {streak} day streak
              </div>
            )}
            <ThemeToggle />
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/features/daily/DailyScreen.test.tsx`
Expected: PASS (all four states). If the streak chip pluralization trips the `/1 day streak/` matcher, confirm the copy is exactly `🔥 {n} day streak`.

- [ ] **Step 5: Typecheck + lint + commit**

Run: `pnpm typecheck && pnpm lint`
```bash
git add src/features/daily/DailyScreen.tsx src/features/daily/DailyScreen.test.tsx
git commit -m "feat: add DailyScreen shell with streak + resume + caught-up states"
```

---

### Task 8: Wire routes — `/` daily, `/play` dev harness

**Files:**
- Modify: `src/app/page.tsx` (render `<DailyScreen/>`)
- Create: `src/app/play/page.tsx` (unlinked Slice-1 harness)

**Interfaces:**
- Consumes: `DailyScreen` (`@/features/daily/DailyScreen`); `PlayScreen`, `BUILTINS` for the harness.
- Produces: routes only.

- [ ] **Step 1: Repoint `/` to the daily**

`src/app/page.tsx` (replace entire file):
```tsx
import { DailyScreen } from "@/features/daily/DailyScreen";

export default function Home() {
  return <DailyScreen />;
}
```

- [ ] **Step 2: Add the unlinked dev harness**

`src/app/play/page.tsx`:
```tsx
// Unlinked dev/QA harness — NOT a product surface. Keeps the Slice-1 free-play
// board reachable for manual board testing until the archive (Slice #5) ships.
import { PlayScreen } from "@/features/play/PlayScreen";
import { BUILTINS } from "@/lib/puzzles/builtins";

export default function PlayHarness() {
  return <PlayScreen puzzles={BUILTINS} />;
}
```

- [ ] **Step 3: Full verification — tests, types, lint, build**

Run: `pnpm test:run && pnpm typecheck && pnpm lint && pnpm build`
Expected: all green; `pnpm build` compiles both `/` and `/play` routes with no errors or hydration warnings.

- [ ] **Step 4: Manual smoke (optional but recommended)**

Run: `pnpm dev`, open `/` — today's daily renders with the date header; solving it shows the done card + streak; reload keeps the done state. Open `/play` — the cycling free-play harness still works.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/play/page.tsx
git commit -m "feat: route / to the daily, demote free-play to /play harness"
```

---

## Self-Review (against the spec)

- **Single puzzle/day, varied bundled pool, auto-graded** → Tasks 1 (resolution), 4 (pool + grading gate). ✓
- **Append-only ordered list + epoch; no `hash % len`** → Task 1 (`dailyFor` = `list[index]`) + pinning test; Global Constraints. ✓
- **Past-stability** → pinning test (Task 1) + append-only discipline (Tasks 1, 4). ✓
- **Local calendar date as "today", client-only resolution, skeleton-until-mounted** → Task 6 (`todayLocal`) + Task 7 (mount effect, `nowDate` injection). ✓
- **Calendar-strict streak (current + lastCompleted), display-breaks-on-miss** → Task 2. ✓
- **Same-day board resume + completion + elapsed, versioned SSR-safe store** → Task 3 (store) + Task 5 (seam) + Task 7 (wiring). ✓
- **Reuse board engine, suppress "New picture", no engine fork** → Task 5 (additive options) + Task 6 (`DailyBoard` reuses `usePuzzleGame`/`Board`). ✓
- **No free-play feature; `/play` unlinked harness; completion leaves room for archive** → Tasks 6, 8. ✓
- **End states: completed / caught-up / before-epoch** → Tasks 6, 7. ✓
- **a11y inherited + streak/date as real text with aria-label** → Task 6 (live region reused) + Task 7 (streak `aria-label`). ✓
- **Seed ≈14 days; integrity (unique, line-solvable, graded)** → Task 4. ✓

**Placeholder scan:** none — every step carries real code/commands. (Task 4 intentionally has the executor author picture data via the solver gate; the throwaway `_candidate_check` harness + integrity test make that a concrete, verifiable loop rather than a placeholder.)

**Type consistency:** `PuzzleGameSnapshot` (Task 5) is the single shape used by `DailyBoard`/`DailyScreen` (`onChange`/`initial`) and mapped to/from `DailyToday` (Task 3) in `DailyScreen`. `DailyResult`/`StreakState`/`DailyStore` names match across tasks. ✓
</content>
