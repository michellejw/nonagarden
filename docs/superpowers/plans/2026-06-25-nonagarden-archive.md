# Nonagarden Archive (slice #5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat Library wall with a NYT-style daily Archive — a calendar of past dailies you can replay (date-keyed), with the streak surfaced.

**Architecture:** Two pure modules (`calendar.ts` builds the month/cell model; `resolve.ts` maps a date → puzzle) feed three client components (`ArchiveCalendar` presentational, `ArchiveScreen` orchestrator, `ArchivePlayScreen` play+reveal). Two ISR server routes (`/archive`, `/archive/[date]`) fetch published content via the existing `fetchDailyContent`. The cleared ledger, in-progress board store, and `usePuzzleGame`/`Board` are reused unchanged; `LibraryPlayScreen`/`LibraryScreen`/`PuzzleTile` are deleted and `/library*` 301-redirects to `/archive`.

**Tech Stack:** Next.js 16 (App Router, ISR), React 19, Tailwind v4, `@shroomgames/tokens`, Supabase (read), vitest + jsdom + @testing-library/react, pnpm.

## Global Constraints

- Package manager: **pnpm** (never npm/yarn).
- Test runner: `pnpm test:run` (= `NODE_OPTIONS=--no-experimental-webstorage vitest run`). Single file: `pnpm test:run src/path/to/file.test.ts`.
- Typecheck: `pnpm typecheck`. Lint: `pnpm lint`. Prod build: `pnpm build`. All must be green before the slice merges.
- **Clock is read in exactly one place:** `todayLocal()` from `@/features/daily/todayDate`. Pure modules NEVER read the clock — `today` is always injected as a `"YYYY-MM-DD"` string. Components accept an optional `nowDate?` prop for deterministic tests (mirror `DailyScreen`/`LibraryPlayScreen`).
- **Schedule is positional and append-only:** `schedule[position] === puzzleId`, `""` marks a gap. `position === daysSince(DAILY_EPOCH, date)`. Never compact it.
- `DAILY_EPOCH = "2026-06-22"` (from `@/lib/daily`).
- Date strings are `"YYYY-MM-DD"` and compare correctly with `<`/`>` (lexicographic === chronological).
- **Streak is day-of only:** the Archive READS the streak for display (`currentStreakAsOf`) but NEVER writes it. `src/lib/daily/streak.ts` is untouched.
- Reuse stores as-is: cleared ledger `@/lib/library/cleared` (keyed by puzzle id), board store `@/lib/library/store` (keyed by puzzle id). Keep their module paths and localStorage keys — they are the Archive's spine now; renaming would churn the Daily's imports for no gain.
- Hidden-name rule carries over: a puzzle's `name` and picture stay hidden until solved; the play header is neutral, the reveal happens in the win card / reveal view.

---

## File structure

**Create:**
- `src/lib/archive/calendar.ts` — pure `buildCalendar()` + model types.
- `src/lib/archive/calendar.test.ts`
- `src/lib/archive/resolve.ts` — pure `dateToPuzzle()` + `ResolveResult`.
- `src/lib/archive/resolve.test.ts`
- `src/features/archive/ArchiveCalendar.tsx` — presentational month grid.
- `src/features/archive/ArchiveCalendar.test.tsx`
- `src/features/archive/ArchiveScreen.tsx` — client orchestrator.
- `src/features/archive/ArchiveScreen.test.tsx`
- `src/features/archive/ArchivePlayScreen.tsx` — play + reveal + gates (absorbs LibraryPlayScreen).
- `src/features/archive/ArchivePlayScreen.test.tsx`
- `src/app/archive/page.tsx` — ISR calendar route.
- `src/app/archive/[date]/page.tsx` — ISR play route.

**Modify:**
- `src/components/AppHeader.tsx` — "Library"→"Archive", `/library`→`/archive`.
- `src/components/AppHeader.test.tsx` — update expectation.
- `next.config.ts` — add `/library` + `/library/:slug` → `/archive` permanent redirects.

**Delete:**
- `src/app/library/page.tsx`, `src/app/library/[slug]/page.tsx` (and now-empty `src/app/library/` tree).
- `src/features/library/LibraryScreen.tsx` (+ `.test.tsx`), `LibraryPlayScreen.tsx` (+ `.test.tsx`), `PuzzleTile.tsx` (+ `.test.tsx`).

**Keep (do NOT touch):** `src/lib/library/cleared.ts`, `src/lib/library/store.ts` (+ their tests), `src/components/DifficultyBadge.tsx`, all of `src/features/play/` and `src/lib/daily/`.

---

## Task 1: Calendar model (pure)

**Files:**
- Create: `src/lib/archive/calendar.ts`
- Test: `src/lib/archive/calendar.test.ts`

**Interfaces:**
- Consumes: `daysSince` from `@/lib/daily`.
- Produces:
  - `type CellState = "today" | "cleared" | "in-progress" | "uncleared" | "gap" | "future" | "before-epoch" | "pad"`
  - `interface DayCell { date: string | null; day: number | null; state: CellState; puzzleId?: string; cleared?: boolean }`
  - `interface MonthGroup { year: number; month: number; label: string; cells: DayCell[] }`
  - `interface CalendarModel { months: MonthGroup[] }`
  - `function buildCalendar(input: { epoch: string; today: string; schedule: readonly string[]; clearedIds: ReadonlySet<string>; inProgressIds: ReadonlySet<string> }): CalendarModel`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/archive/calendar.test.ts
import { describe, it, expect } from "vitest";
import { buildCalendar, type DayCell, type CalendarModel } from "./calendar";

const EPOCH = "2026-06-22";

function cellFor(model: CalendarModel, date: string): DayCell | undefined {
  for (const m of model.months) {
    const hit = m.cells.find((c) => c.date === date);
    if (hit) return hit;
  }
  return undefined;
}

describe("buildCalendar", () => {
  const base = {
    epoch: EPOCH,
    today: "2026-06-24",
    schedule: ["a", "b", "c"] as const,
    clearedIds: new Set(["a"]),
    inProgressIds: new Set(["b"]),
  };

  it("classifies cleared, in-progress, today, future and before-epoch days", () => {
    const model = buildCalendar(base);
    expect(cellFor(model, "2026-06-22")).toMatchObject({ state: "cleared", puzzleId: "a" });
    expect(cellFor(model, "2026-06-23")).toMatchObject({ state: "in-progress", puzzleId: "b" });
    expect(cellFor(model, "2026-06-24")).toMatchObject({ state: "today", puzzleId: "c", cleared: false });
    expect(cellFor(model, "2026-06-25")).toMatchObject({ state: "future" });
    expect(cellFor(model, "2026-06-21")).toMatchObject({ state: "before-epoch" });
  });

  it("marks an untouched past day uncleared and an empty schedule slot as a gap", () => {
    const model = buildCalendar({
      ...base,
      today: "2026-06-25",
      schedule: ["a", "", "c"],
      clearedIds: new Set<string>(),
      inProgressIds: new Set<string>(),
    });
    expect(cellFor(model, "2026-06-22")).toMatchObject({ state: "uncleared", puzzleId: "a" });
    expect(cellFor(model, "2026-06-23")).toMatchObject({ state: "gap" });
  });

  it("shows today's mushroom as cleared when today is solved", () => {
    const model = buildCalendar({ ...base, clearedIds: new Set(["a", "c"]) });
    expect(cellFor(model, "2026-06-24")).toMatchObject({ state: "today", cleared: true });
  });

  it("lists the epoch month most-recent-first with a leading weekday pad", () => {
    const model = buildCalendar(base);
    expect(model.months[0].label).toBe("June 2026");
    // June 1 2026 is a Monday → one leading Sunday pad cell.
    expect(model.months[0].cells[0]).toEqual({ date: null, day: null, state: "pad" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/lib/archive/calendar.test.ts`
Expected: FAIL — `buildCalendar` not found / module missing.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/archive/calendar.ts
import { daysSince } from "@/lib/daily";

export type CellState =
  | "today" // today's date — routes to the front door (live daily)
  | "cleared" // past, scheduled, solved
  | "in-progress" // past, scheduled, has a saved board, not solved
  | "uncleared" // past, scheduled, untouched
  | "gap" // past, scheduled slot empty / beyond the list
  | "future" // date after today
  | "before-epoch" // date before the daily run started
  | "pad"; // leading weekday filler, no date

export interface DayCell {
  date: string | null; // "YYYY-MM-DD"; null only for "pad"
  day: number | null; // 1..31; null only for "pad"
  state: CellState;
  puzzleId?: string; // present for today/cleared/in-progress/uncleared
  cleared?: boolean; // for "today": also solved? (colour mushroom + ring)
}

export interface MonthGroup {
  year: number;
  month: number; // 1..12
  label: string; // "June 2026"
  cells: DayCell[]; // leading pad cells, then one per day-of-month
}

export interface CalendarModel {
  months: MonthGroup[]; // most-recent month first
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Deterministic from explicit args — no clock is read.
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate(); // day 0 of next month = last day
}
function firstWeekday(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay(); // 0=Sun .. 6=Sat
}
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function classifyDay(
  date: string,
  day: number,
  epoch: string,
  today: string,
  schedule: readonly string[],
  clearedIds: ReadonlySet<string>,
  inProgressIds: ReadonlySet<string>,
): DayCell {
  if (date < epoch) return { date, day, state: "before-epoch" };
  if (date > today) return { date, day, state: "future" };

  const position = daysSince(epoch, date);
  const id = position < schedule.length ? schedule[position] : "";

  if (date === today) {
    if (!id) return { date, day, state: "today" };
    return { date, day, state: "today", puzzleId: id, cleared: clearedIds.has(id) };
  }
  if (!id) return { date, day, state: "gap" };
  if (clearedIds.has(id)) return { date, day, state: "cleared", puzzleId: id };
  if (inProgressIds.has(id)) return { date, day, state: "in-progress", puzzleId: id };
  return { date, day, state: "uncleared", puzzleId: id };
}

export function buildCalendar(input: {
  epoch: string;
  today: string;
  schedule: readonly string[];
  clearedIds: ReadonlySet<string>;
  inProgressIds: ReadonlySet<string>;
}): CalendarModel {
  const { epoch, today, schedule, clearedIds, inProgressIds } = input;
  const [ey, em] = epoch.split("-").map(Number);
  const [ty, tm] = today.split("-").map(Number);

  const months: MonthGroup[] = [];
  let y = ty;
  let m = tm;
  // Walk months from today's month back to the epoch's month, inclusive.
  while (y > ey || (y === ey && m >= em)) {
    const cells: DayCell[] = [];
    const lead = firstWeekday(y, m);
    for (let i = 0; i < lead; i++) cells.push({ date: null, day: null, state: "pad" });
    const dim = daysInMonth(y, m);
    for (let d = 1; d <= dim; d++) {
      const date = `${y}-${pad2(m)}-${pad2(d)}`;
      cells.push(classifyDay(date, d, epoch, today, schedule, clearedIds, inProgressIds));
    }
    months.push({ year: y, month: m, label: `${MONTH_NAMES[m - 1]} ${y}`, cells });
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return { months };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/lib/archive/calendar.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/archive/calendar.ts src/lib/archive/calendar.test.ts
git commit -m "feat: pure archive calendar model"
```

---

## Task 2: Date→puzzle resolver (pure)

**Files:**
- Create: `src/lib/archive/resolve.ts`
- Test: `src/lib/archive/resolve.test.ts`

**Interfaces:**
- Consumes: `dailyFor` from `@/lib/daily`; `Puzzle` from `@/lib/nonogram`.
- Produces:
  - `type ResolveResult = { kind: "puzzle"; puzzle: Puzzle } | { kind: "today" } | { kind: "future" } | { kind: "before-epoch" } | { kind: "gap" } | { kind: "not-found" }`
  - `function dateToPuzzle(date: string, today: string, schedule: readonly string[], puzzles: readonly Puzzle[]): ResolveResult`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/archive/resolve.test.ts
import { describe, it, expect } from "vitest";
import { dateToPuzzle } from "./resolve";
import type { Puzzle } from "@/lib/nonogram";

const A: Puzzle = { id: "a", name: "Acorn", size: 2, rows: ["##", "##"] };
const C: Puzzle = { id: "c", name: "Cup", size: 2, rows: ["##", "##"] };
const PUZZLES = [A, C];
const TODAY = "2026-06-24"; // epoch + 2

describe("dateToPuzzle", () => {
  const schedule = ["a", "b", "c"]; // "b" has no matching puzzle

  it("resolves a past scheduled date to its puzzle", () => {
    expect(dateToPuzzle("2026-06-22", TODAY, schedule, PUZZLES)).toEqual({ kind: "puzzle", puzzle: A });
  });
  it("returns today for today's date", () => {
    expect(dateToPuzzle("2026-06-24", TODAY, schedule, PUZZLES)).toEqual({ kind: "today" });
  });
  it("gates a future date", () => {
    expect(dateToPuzzle("2026-06-25", TODAY, schedule, PUZZLES)).toEqual({ kind: "future" });
  });
  it("rejects a date before the epoch", () => {
    expect(dateToPuzzle("2026-06-21", TODAY, schedule, PUZZLES)).toEqual({ kind: "before-epoch" });
  });
  it("returns gap for an empty schedule slot", () => {
    expect(dateToPuzzle("2026-06-22", TODAY, ["", "b", "c"], PUZZLES)).toEqual({ kind: "gap" });
  });
  it("returns gap for a past date beyond the schedule", () => {
    expect(dateToPuzzle("2026-06-23", "2026-06-30", ["a"], PUZZLES)).toEqual({ kind: "gap" });
  });
  it("returns not-found when the scheduled id has no puzzle", () => {
    expect(dateToPuzzle("2026-06-23", TODAY, schedule, PUZZLES)).toEqual({ kind: "not-found" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/lib/archive/resolve.test.ts`
Expected: FAIL — `dateToPuzzle` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/archive/resolve.ts
import { dailyFor } from "@/lib/daily";
import type { Puzzle } from "@/lib/nonogram";

export type ResolveResult =
  | { kind: "puzzle"; puzzle: Puzzle }
  | { kind: "today" } // play it on the front door instead
  | { kind: "future" }
  | { kind: "before-epoch" }
  | { kind: "gap" }
  | { kind: "not-found" };

// `today` is injected (the player's local date). `dailyFor` resolves against
// DAILY_EPOCH using the positional schedule, exactly as the Daily front door does.
export function dateToPuzzle(
  date: string,
  today: string,
  schedule: readonly string[],
  puzzles: readonly Puzzle[],
): ResolveResult {
  if (date === today) return { kind: "today" };
  const res = dailyFor(date, schedule);
  if (res.kind === "before-epoch") return { kind: "before-epoch" };
  if (date > today) return { kind: "future" };
  if (res.kind === "none") return { kind: "gap" };
  const id = res.puzzleId;
  if (!id) return { kind: "gap" };
  const puzzle = puzzles.find((p) => p.id === id);
  return puzzle ? { kind: "puzzle", puzzle } : { kind: "not-found" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/lib/archive/resolve.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/archive/resolve.ts src/lib/archive/resolve.test.ts
git commit -m "feat: pure archive date-to-puzzle resolver"
```

---

## Task 3: ArchiveCalendar (presentational)

**Files:**
- Create: `src/features/archive/ArchiveCalendar.tsx`
- Test: `src/features/archive/ArchiveCalendar.test.tsx`

**Interfaces:**
- Consumes: `CalendarModel`, `DayCell` from `@/lib/archive/calendar`; `next/link`.
- Produces: `function ArchiveCalendar({ model }: { model: CalendarModel }): JSX.Element`. Interactive cells render an `<a>` (via `Link`): today → `href="/"`; cleared/in-progress/uncleared → `href="/archive/<date>"`. Each interactive cell has `aria-label` containing the date and `"cleared"` or `"not cleared"`. Inactive cells (pad/before-epoch/future/gap) render no link.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/archive/ArchiveCalendar.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ArchiveCalendar } from "./ArchiveCalendar";
import type { CalendarModel } from "@/lib/archive/calendar";

const MODEL: CalendarModel = {
  months: [
    {
      year: 2026, month: 6, label: "June 2026",
      cells: [
        { date: null, day: null, state: "pad" },
        { date: "2026-06-22", day: 22, state: "cleared", puzzleId: "a" },
        { date: "2026-06-23", day: 23, state: "uncleared", puzzleId: "b" },
        { date: "2026-06-24", day: 24, state: "today", puzzleId: "c", cleared: false },
        { date: "2026-06-25", day: 25, state: "future" },
      ],
    },
  ],
};

describe("ArchiveCalendar", () => {
  it("shows the month label", () => {
    render(<ArchiveCalendar model={MODEL} />);
    expect(screen.getByText("June 2026")).toBeInTheDocument();
  });

  it("links a cleared past day to its dated play route and marks it cleared", () => {
    render(<ArchiveCalendar model={MODEL} />);
    const link = screen.getByRole("link", { name: /2026-06-22.*cleared/i });
    expect(link).toHaveAttribute("href", "/archive/2026-06-22");
  });

  it("links today's cell to the front door", () => {
    render(<ArchiveCalendar model={MODEL} />);
    const link = screen.getByRole("link", { name: /2026-06-24/i });
    expect(link).toHaveAttribute("href", "/");
  });

  it("renders no link for a future day", () => {
    render(<ArchiveCalendar model={MODEL} />);
    expect(screen.queryByRole("link", { name: /2026-06-25/i })).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/features/archive/ArchiveCalendar.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/archive/ArchiveCalendar.tsx
import Link from "next/link";
import type { CalendarModel, DayCell } from "@/lib/archive/calendar";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function isClearedLook(cell: DayCell): boolean {
  return cell.state === "cleared" || (cell.state === "today" && cell.cleared === true);
}

function Mushroom({ cell }: { cell: DayCell }) {
  if (cell.state === "gap") return null;
  // Cleared (or today-solved): full colour. In-progress: full colour. Untouched
  // past / today-unsolved: muted. Symbolic — the picture reveal lives on the detail view.
  const muted = cell.state === "uncleared" || (cell.state === "today" && !cell.cleared);
  return (
    <span aria-hidden className={`text-base leading-none ${muted ? "opacity-40 grayscale" : ""}`}>
      🍄
    </span>
  );
}

function Cell({ cell }: { cell: DayCell }) {
  if (cell.state === "pad") return <span aria-hidden />;

  const inactive = cell.state === "before-epoch" || cell.state === "future" || cell.state === "gap";
  const ring = cell.state === "today" ? "ring-2 ring-accent" : "";
  const showMushroom = !inactive || cell.state === "gap";

  const body = (
    <div
      className={`flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl ${ring} ${
        inactive ? "opacity-35" : "bg-card"
      }`}
    >
      <span className="text-xs font-semibold text-ink">{cell.day}</span>
      {showMushroom && <Mushroom cell={cell} />}
    </div>
  );

  if (inactive) return body;

  const href = cell.state === "today" ? "/" : `/archive/${cell.date}`;
  const label = `${cell.date}, ${isClearedLook(cell) ? "cleared" : "not cleared"}`;
  return (
    <Link
      href={href}
      aria-label={label}
      className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {body}
    </Link>
  );
}

export function ArchiveCalendar({ model }: { model: CalendarModel }) {
  return (
    <div className="flex flex-col gap-10">
      {model.months.map((month) => (
        <section key={`${month.year}-${month.month}`}>
          <h2 className="mb-3 text-sm font-semibold text-ink">{month.label}</h2>
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {WEEKDAYS.map((w, i) => (
              <span key={i} className="pb-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-soft">
                {w}
              </span>
            ))}
            {month.cells.map((cell, i) => (
              <Cell key={i} cell={cell} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/features/archive/ArchiveCalendar.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/archive/ArchiveCalendar.tsx src/features/archive/ArchiveCalendar.test.tsx
git commit -m "feat: ArchiveCalendar presentational month grid"
```

---

## Task 4: ArchiveScreen + `/archive` route

**Files:**
- Create: `src/features/archive/ArchiveScreen.tsx`
- Create: `src/app/archive/page.tsx`
- Test: `src/features/archive/ArchiveScreen.test.tsx`

**Interfaces:**
- Consumes: `buildCalendar` from `@/lib/archive/calendar`; `ArchiveCalendar`; `DAILY_EPOCH`, `currentStreakAsOf`, `loadStore` from `@/lib/daily`; `loadCleared` from `@/lib/library/cleared`; `loadLibraryStore` from `@/lib/library/store`; `todayLocal` from `@/features/daily/todayDate`; `Puzzle` from `@/lib/nonogram`; `fetchDailyContent` from `@/lib/content/content`.
- Produces: `function ArchiveScreen({ puzzles, schedule, nowDate }: { puzzles: Puzzle[]; schedule: string[]; nowDate?: string }): JSX.Element`. Reads local date + ledgers once after mount; renders the streak header + `ArchiveCalendar`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/archive/ArchiveScreen.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ArchiveScreen } from "./ArchiveScreen";
import { recordCleared } from "@/lib/library/cleared";
import type { Puzzle } from "@/lib/nonogram";

const PUZZLES: Puzzle[] = [
  { id: "a", name: "Acorn", size: 2, rows: ["##", "##"] },
  { id: "b", name: "Bee", size: 2, rows: ["##", "##"] },
  { id: "c", name: "Cup", size: 2, rows: ["##", "##"] },
];
const SCHEDULE = ["a", "b", "c"]; // epoch+0,+1,+2

beforeEach(() => window.localStorage.clear());

describe("ArchiveScreen", () => {
  it("renders the Archive heading and the epoch month", async () => {
    render(<ArchiveScreen puzzles={PUZZLES} schedule={SCHEDULE} nowDate="2026-06-24" />);
    expect(await screen.findByRole("heading", { name: "Archive" })).toBeInTheDocument();
    expect(screen.getByText("June 2026")).toBeInTheDocument();
  });

  it("links a past day to its dated route and today to the front door", async () => {
    render(<ArchiveScreen puzzles={PUZZLES} schedule={SCHEDULE} nowDate="2026-06-24" />);
    expect(await screen.findByRole("link", { name: /2026-06-22/i })).toHaveAttribute(
      "href", "/archive/2026-06-22",
    );
    expect(screen.getByRole("link", { name: /2026-06-24/i })).toHaveAttribute("href", "/");
  });

  it("marks a cleared day as cleared in its label", async () => {
    recordCleared("a");
    render(<ArchiveScreen puzzles={PUZZLES} schedule={SCHEDULE} nowDate="2026-06-24" />);
    expect(await screen.findByRole("link", { name: /2026-06-22.*cleared/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/features/archive/ArchiveScreen.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/archive/ArchiveScreen.tsx
"use client";

import { useEffect, useState } from "react";
import type { Puzzle } from "@/lib/nonogram";
import { DAILY_EPOCH, currentStreakAsOf, loadStore } from "@/lib/daily";
import { loadCleared } from "@/lib/library/cleared";
import { loadLibraryStore } from "@/lib/library/store";
import { todayLocal } from "@/features/daily/todayDate";
import { buildCalendar } from "@/lib/archive/calendar";
import { ArchiveCalendar } from "./ArchiveCalendar";

export function ArchiveScreen({
  puzzles,
  schedule,
  nowDate,
}: {
  puzzles: Puzzle[];
  schedule: string[];
  nowDate?: string;
}) {
  // Client-only: local date + ledgers + streak resolved once after mount (SSR
  // can't know the player's timezone or localStorage).
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState("");
  const [clearedIds, setClearedIds] = useState<Set<string>>(new Set());
  const [inProgressIds, setInProgressIds] = useState<Set<string>>(new Set());
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const t = nowDate ?? todayLocal();
    const cleared = loadCleared();
    const boards = loadLibraryStore();
    const daily = loadStore();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only bootstrap: local date + ledgers read once after mount.
    setToday(t);
    setClearedIds(new Set(cleared.ids));
    setInProgressIds(new Set(Object.keys(boards.boards)));
    setStreak(currentStreakAsOf(daily.streak, t));
    setReady(true);
  }, [nowDate]);

  if (!ready) return <main className="flex flex-1 flex-col items-center px-6 py-10" />;

  const model = buildCalendar({ epoch: DAILY_EPOCH, today, schedule, clearedIds, inProgressIds });

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex items-baseline justify-between border-b border-border pb-4">
          <h1 className="text-2xl font-semibold text-ink">Archive</h1>
          {streak > 0 && (
            <span className="text-sm font-semibold text-ink-soft">
              {streak === 1 ? "1 day streak" : `${streak} day streak`}
            </span>
          )}
        </div>
        <ArchiveCalendar model={model} />
      </div>
    </main>
  );
}
```

```tsx
// src/app/archive/page.tsx
import { ArchiveScreen } from "@/features/archive/ArchiveScreen";
import { fetchDailyContent } from "@/lib/content/content";

// ISR: re-fetch published content ~hourly, like the Daily. Local date + cleared
// state are resolved on the client.
export const revalidate = 3600;

export default async function ArchivePage() {
  const { puzzles, schedule } = await fetchDailyContent();
  return <ArchiveScreen puzzles={puzzles} schedule={schedule} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/features/archive/ArchiveScreen.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/archive/ArchiveScreen.tsx src/features/archive/ArchiveScreen.test.tsx src/app/archive/page.tsx
git commit -m "feat: ArchiveScreen + /archive ISR route"
```

---

## Task 5: ArchivePlayScreen + `/archive/[date]` route

**Files:**
- Create: `src/features/archive/ArchivePlayScreen.tsx`
- Create: `src/app/archive/[date]/page.tsx`
- Test: `src/features/archive/ArchivePlayScreen.test.tsx`

**Interfaces:**
- Consumes: `dateToPuzzle`, `ResolveResult` from `@/lib/archive/resolve`; `usePuzzleGame`, `PuzzleGameSnapshot` from `@/features/play/usePuzzleGame`; `Board` from `@/features/play/Board`; `formatTime` from `@/features/play/format`; `Mode` from `@/features/play/reducer`; `recordCleared`, `isCleared`, `loadCleared` from `@/lib/library/cleared`; `loadLibraryStore`, `saveBoard`, `dropBoard`, `boardFor` from `@/lib/library/store`; `todayLocal` from `@/features/daily/todayDate`; `solutionOf` from `@/lib/nonogram`; `Puzzle` from `@/lib/nonogram`; `fetchDailyContent` from `@/lib/content/content`; `next/link`.
- Produces: `function ArchivePlayScreen({ date, puzzles, schedule, nowDate }: { date: string; puzzles: Puzzle[]; schedule: string[]; nowDate?: string }): JSX.Element`. Resolves client-side; renders a gate (today/future/missing), a reveal view (cleared), or the play board (uncleared / replay).

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/archive/ArchivePlayScreen.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ArchivePlayScreen } from "./ArchivePlayScreen";
import { recordCleared } from "@/lib/library/cleared";
import type { Puzzle } from "@/lib/nonogram";

const PUZZLES: Puzzle[] = [
  { id: "a", name: "Acorn", size: 2, rows: ["##", "##"] },
  { id: "c", name: "Cup", size: 2, rows: ["##", "##"] },
];
const SCHEDULE = ["a", "b", "c"];
const TODAY = "2026-06-24"; // epoch + 2

beforeEach(() => window.localStorage.clear());

describe("ArchivePlayScreen", () => {
  it("plays an uncleared past day with a hidden name and a back link", async () => {
    render(<ArchivePlayScreen date="2026-06-22" puzzles={PUZZLES} schedule={SCHEDULE} nowDate={TODAY} />);
    await screen.findByRole("grid");
    // Name stays hidden: the answer "Acorn" must not appear before solving.
    expect(screen.queryByText(/acorn/i)).toBeNull();
    expect(screen.getByRole("link", { name: /back to archive/i })).toHaveAttribute("href", "/archive");
  });

  it("opens a cleared day in the reveal view and reveals the name", async () => {
    recordCleared("a");
    render(<ArchivePlayScreen date="2026-06-22" puzzles={PUZZLES} schedule={SCHEDULE} nowDate={TODAY} />);
    expect(await screen.findByText(/acorn/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /play again/i })).toBeInTheDocument();
    // The reveal view is not the playable board.
    expect(screen.queryByRole("grid")).toBeNull();
  });

  it("Play again swaps the reveal for a fresh board", async () => {
    recordCleared("a");
    render(<ArchivePlayScreen date="2026-06-22" puzzles={PUZZLES} schedule={SCHEDULE} nowDate={TODAY} />);
    fireEvent.click(await screen.findByRole("button", { name: /play again/i }));
    expect(await screen.findByRole("grid")).toBeInTheDocument();
  });

  it("gates a future date", async () => {
    render(<ArchivePlayScreen date="2026-06-25" puzzles={PUZZLES} schedule={SCHEDULE} nowDate={TODAY} />);
    expect(await screen.findByText(/hasn’t sprouted yet/i)).toBeInTheDocument();
  });

  it("sends today's date back to the front door", async () => {
    render(<ArchivePlayScreen date="2026-06-24" puzzles={PUZZLES} schedule={SCHEDULE} nowDate={TODAY} />);
    expect(await screen.findByRole("link", { name: /today’s daily/i })).toHaveAttribute("href", "/");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/features/archive/ArchivePlayScreen.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/archive/ArchivePlayScreen.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Puzzle } from "@/lib/nonogram";
import { solutionOf } from "@/lib/nonogram";
import { usePuzzleGame, type PuzzleGameSnapshot } from "@/features/play/usePuzzleGame";
import { Board } from "@/features/play/Board";
import { formatTime } from "@/features/play/format";
import type { Mode } from "@/features/play/reducer";
import { recordCleared, isCleared, loadCleared } from "@/lib/library/cleared";
import { loadLibraryStore, saveBoard, dropBoard, boardFor } from "@/lib/library/store";
import { todayLocal } from "@/features/daily/todayDate";
import { dateToPuzzle, type ResolveResult } from "@/lib/archive/resolve";

const MODES: { value: Mode; label: string }[] = [
  { value: "fill", label: "Fill" },
  { value: "mark", label: "Mark" },
];

function formatLongDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  // Pure formatting — builds a Date from explicit parts; no clock is read.
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });
}

function Gate({ title, body, cta }: { title: string; body: string; cta: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="rounded-2xl bg-card p-6 text-center">
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
        <p className="mt-2 text-sm text-ink-soft">{body}</p>
        <div className="mt-4">{cta}</div>
      </div>
    </main>
  );
}

const backToArchive = (
  <Link href="/archive" className="inline-block rounded-xl bg-pill px-4 py-2 text-sm font-semibold text-ink hover:opacity-90">
    Back to archive
  </Link>
);

export function ArchivePlayScreen({
  date,
  puzzles,
  schedule,
  nowDate,
}: {
  date: string;
  puzzles: Puzzle[];
  schedule: string[];
  nowDate?: string;
}) {
  // Resolve client-side so future/today gating uses the player's LOCAL date and
  // the saved board is seen by usePuzzleGame's lazy initializer on first render.
  const [ready, setReady] = useState(false);
  const [result, setResult] = useState<ResolveResult | null>(null);
  const [cleared, setCleared] = useState(false);
  const [initial, setInitial] = useState<PuzzleGameSnapshot | undefined>(undefined);
  const [replaying, setReplaying] = useState(false);

  useEffect(() => {
    const today = nowDate ?? todayLocal();
    const res = dateToPuzzle(date, today, schedule, puzzles);
    if (res.kind === "puzzle") {
      const saved = boardFor(loadLibraryStore(), res.puzzle.id);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only bootstrap: read ledger + saved board once after mount before mounting the game.
      setCleared(isCleared(loadCleared(), res.puzzle.id));
      if (saved) setInitial({ cells: saved.cells, won: saved.completed, frozenElapsed: saved.elapsedMs });
    }
    setResult(res);
    setReady(true);
  }, [date, schedule, puzzles, nowDate]);

  if (!ready || result === null) return <main className="flex flex-1 flex-col items-center px-6 py-10" />;

  if (result.kind === "today")
    return (
      <Gate
        title="That one’s today’s daily"
        body="Play today’s puzzle on the front door."
        cta={
          <Link href="/" className="inline-block rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:opacity-90">
            Play today’s daily
          </Link>
        }
      />
    );
  if (result.kind === "future")
    return <Gate title="This day hasn’t sprouted yet 🌱" body="Come back when it’s the daily." cta={backToArchive} />;
  if (result.kind !== "puzzle")
    return <Gate title="No puzzle for that day" body="The garden wasn’t planted here." cta={backToArchive} />;

  const puzzle = result.puzzle;
  if (cleared && !replaying)
    return <RevealView puzzle={puzzle} date={date} onReplay={() => setReplaying(true)} />;
  return <ArchiveBoard puzzle={puzzle} date={date} initial={replaying ? undefined : initial} />;
}

function RevealView({ puzzle, date, onReplay }: { puzzle: Puzzle; date: string; onReplay: () => void }) {
  const sol = solutionOf(puzzle);
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-fit text-center">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[1.3px] text-ink-soft">
          {formatLongDate(date)}
        </span>
        <div
          className="mx-auto mt-4 grid aspect-square w-48 overflow-hidden rounded-xl"
          style={{ gridTemplateColumns: `repeat(${puzzle.size}, 1fr)` }}
          aria-hidden
        >
          {sol.flatMap((row, r) =>
            row.map((filled, c) => <span key={`${r}-${c}`} className={filled ? "bg-ink" : "bg-card"} />),
          )}
        </div>
        <h2 className="mt-4 text-2xl font-semibold text-ink">{puzzle.name}</h2>
        <div className="mt-5 flex justify-center gap-[10px]">
          {backToArchive}
          <button
            type="button"
            onClick={onReplay}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:opacity-90"
          >
            Play again
          </button>
        </div>
      </div>
    </main>
  );
}

function ArchiveBoard({ puzzle, date, initial }: { puzzle: Puzzle; date: string; initial: PuzzleGameSnapshot | undefined }) {
  const persist = (snap: PuzzleGameSnapshot) => {
    if (snap.won) {
      recordCleared(puzzle.id); // global ledger; never touches streak
      dropBoard(puzzle.id);
      return;
    }
    const hasProgress = snap.cells.some((row) => row.some((v) => v !== 0));
    if (hasProgress) {
      saveBoard(puzzle.id, { cells: snap.cells, completed: false, elapsedMs: snap.frozenElapsed });
    } else {
      dropBoard(puzzle.id);
    }
  };

  const game = usePuzzleGame([puzzle], { initial, onChange: persist });

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-fit">
        <div className="mb-5 flex items-start justify-between gap-7">
          <div className="flex flex-col gap-[3px]">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[1.3px] text-ink-soft">
              {formatLongDate(date)}
            </span>
            <span className="text-[2.5rem] font-semibold leading-none text-ink">
              {puzzle.size} × {puzzle.size}
            </span>
          </div>
          <div className="inline-flex min-w-[88px] items-center rounded-pill bg-pill px-[15px] py-[9px]">
            <span className="font-mono text-xl font-semibold tabular-nums text-ink">{formatTime(game.elapsedMs)}</span>
          </div>
        </div>

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
          <div className="flex items-center gap-[10px]">
            <button type="button" onClick={game.reset} className="rounded-xl px-4 py-2 text-sm font-semibold text-ink-soft hover:text-ink">
              Reset
            </button>
            <Link href="/archive" className="rounded-xl bg-pill px-4 py-2 text-sm font-semibold text-ink hover:opacity-90">
              Back to archive
            </Link>
          </div>
        </div>

        {game.won && (
          <div className="mt-4 rounded-2xl bg-card p-5" style={{ animation: "ng-rise .35s ease-out" }}>
            <h2 className="text-2xl font-semibold text-ink">Picture complete!</h2>
            <p className="mt-1 text-sm text-ink-soft">
              It&apos;s a {puzzle.name.toLowerCase()} — solved in {formatTime(game.elapsedMs)}.
            </p>
            <div className="mt-4 flex gap-[10px]">
              <Link href="/archive" className="rounded-xl bg-pill px-4 py-2 text-sm font-semibold text-ink hover:opacity-90">
                Back to archive
              </Link>
              <button type="button" onClick={game.reset} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:opacity-90">
                Play again
              </button>
            </div>
          </div>
        )}

        <div role="status" aria-live="polite" className="sr-only">
          {game.won ? `Picture complete — it's a ${puzzle.name.toLowerCase()}.` : ""}
        </div>
      </div>
    </main>
  );
}
```

```tsx
// src/app/archive/[date]/page.tsx
import { ArchivePlayScreen } from "@/features/archive/ArchivePlayScreen";
import { fetchDailyContent } from "@/lib/content/content";

export const revalidate = 3600;

export default async function ArchivePlayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  // Pass ALL published content; the client resolves date→puzzle with its local
  // date so future/today gating agrees in every timezone (mirrors the daily).
  const { puzzles, schedule } = await fetchDailyContent();
  return <ArchivePlayScreen date={date} puzzles={puzzles} schedule={schedule} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/features/archive/ArchivePlayScreen.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/archive/ArchivePlayScreen.tsx src/features/archive/ArchivePlayScreen.test.tsx src/app/archive/[date]/page.tsx
git commit -m "feat: ArchivePlayScreen + /archive/[date] route (reveal + replay)"
```

---

## Task 6: Swap nav, redirect /library, delete the old wall, verify green

**Files:**
- Modify: `src/components/AppHeader.tsx`, `src/components/AppHeader.test.tsx`
- Modify: `next.config.ts`
- Create: `next.config.test.ts` (repo root)
- Delete: `src/app/library/page.tsx`, `src/app/library/[slug]/page.tsx`, `src/features/library/LibraryScreen.tsx`(+test), `LibraryPlayScreen.tsx`(+test), `PuzzleTile.tsx`(+test)

**Interfaces:**
- Consumes: nothing new.
- Produces: header nav pointing at `/archive`; framework-level 301s from `/library` and `/library/:slug` to `/archive`.

- [ ] **Step 1: Update the AppHeader test (failing)**

Replace the Library expectation in `src/components/AppHeader.test.tsx`:

```tsx
  it("renders Daily and Archive nav links", () => {
    render(<AppHeader />);
    expect(screen.getByRole("link", { name: /daily/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /archive/i })).toHaveAttribute("href", "/archive");
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test:run src/components/AppHeader.test.tsx`
Expected: FAIL — no link named "archive" / still points to `/library`.

- [ ] **Step 3: Update AppHeader**

In `src/components/AppHeader.tsx`, replace the Library link:

```tsx
        <Link
          href="/archive"
          className="text-sm font-semibold text-ink-soft hover:text-ink"
        >
          Archive
        </Link>
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm test:run src/components/AppHeader.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the redirect config test (failing)**

First read `next.config.ts` to see its current shape (it may be `const nextConfig = {...}` with a default export). Then write:

```ts
// next.config.test.ts (repo root)
import { describe, it, expect } from "vitest";
import config from "./next.config";

describe("next.config redirects", () => {
  it("permanently redirects the retired library routes to /archive", async () => {
    const redirects = await config.redirects!();
    expect(redirects).toContainEqual({ source: "/library", destination: "/archive", permanent: true });
    expect(redirects).toContainEqual({ source: "/library/:slug", destination: "/archive", permanent: true });
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm test:run next.config.test.ts`
Expected: FAIL — `config.redirects` is undefined / array empty.

- [ ] **Step 7: Add redirects to next.config.ts**

Add the `redirects` method to the exported config object (keep any existing fields):

```ts
  async redirects() {
    return [
      { source: "/library", destination: "/archive", permanent: true },
      { source: "/library/:slug", destination: "/archive", permanent: true },
    ];
  },
```

- [ ] **Step 8: Run it to verify it passes**

Run: `pnpm test:run next.config.test.ts`
Expected: PASS.

- [ ] **Step 9: Delete the retired library UI**

```bash
git rm src/app/library/page.tsx src/app/library/[slug]/page.tsx \
  src/features/library/LibraryScreen.tsx src/features/library/LibraryScreen.test.tsx \
  src/features/library/LibraryPlayScreen.tsx src/features/library/LibraryPlayScreen.test.tsx \
  src/features/library/PuzzleTile.tsx src/features/library/PuzzleTile.test.tsx
```

Then grep for stragglers and fix any import that still references the deleted modules:

Run: `rg -n "features/library/(LibraryScreen|LibraryPlayScreen|PuzzleTile)|app/library" src`
Expected: no matches. (`src/lib/library/*` is KEPT — those are the stores, not UI.)

- [ ] **Step 10: Full verification**

Run each and confirm green:

```bash
pnpm test:run
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all pass; `pnpm build` shows `/archive` and `/archive/[date]` routes and the `/library` redirects.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: retire Library wall — Archive nav + /library 301s + cleanup"
```

---

## Self-review (completed by plan author)

**Spec coverage:**
- Retire Library wall + redirects → Task 6. ✓
- `/archive` calendar (ISR) → Task 4. ✓
- `/archive/[date]` date-based play → Task 5. ✓
- Range epoch→today, no sliding floor → `buildCalendar` walks epoch-month→today-month (Task 1). ✓
- Pool puzzles invisible until scheduled → only `schedule[]` positions are rendered/resolved; unscheduled ids never appear (Tasks 1–2). ✓
- Streak day-of only → Archive reads `currentStreakAsOf`, never writes (Task 4); `streak.ts` untouched. ✓
- Symbolic mushroom cells, no thumbnails on calendar → Task 3 `Mushroom`. ✓
- Cleared-day → reveal + Play again; uncleared → play; today → front door; guards → Task 5. ✓
- Hidden name until solved → play header shows the date, name only in reveal/win card (Task 5 test asserts "Acorn" hidden pre-solve). ✓
- Reuse cleared ledger + board store + usePuzzleGame/Board; absorb LibraryPlayScreen → Tasks 4–6. ✓
- Mobile/touch, schema changes, extras shelf → out of scope, not planned. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; every test step shows real assertions.

**Type consistency:** `buildCalendar` input/`CalendarModel`/`DayCell` consumed identically in Tasks 3–4; `ResolveResult` kinds produced in Task 2 are all handled in Task 5 (`today`/`future`/`before-epoch`/`gap`/`not-found`/`puzzle`); `PuzzleGameSnapshot`, `saveBoard`/`dropBoard`/`boardFor`, `recordCleared`/`isCleared`/`loadCleared`, `loadStore`/`currentStreakAsOf` match the verified source signatures.

**Note carried to execution:** `src/lib/library/cleared.ts` and `store.ts` intentionally keep their `@/lib/library/...` paths and `nonagarden.*.v1` keys (shared with the Daily) — do not rename.
