# Nonagarden — Daily (Slice 3) Design Spec

**Date:** 2026-06-20
**Project:** Nonagarden — the first Shroom Games *web* game (cozy nonogram / Picross).
**Slice:** 3 of N — **Daily**. A deterministic date→puzzle pick, plus streak + same-day resume. Runs off **bundled** content (no backend).
**Status:** Approved design, ready for implementation plan.

---

## Context

Slice 1 (Core Play) is built and merged: a playable, accessible single-board nonogram with a pure, tested logic core (`src/lib/nonogram/`), built-in puzzles (`src/lib/puzzles/builtins.ts`), and a reducer-driven `PlayScreen` rendered at `/`. The board engine — `usePuzzleGame`, `Board`, `ClueLine`, `Cell`, the reducer — is solid and is **reused untouched** here.

This slice builds the **Daily**: the game's front door. Each calendar day resolves to exactly one puzzle, deterministically, from a bundled ordered list. Returning to the daily later the same day resumes the in-progress board; completing it advances a streak. This is also where the long-parked *daily content pipeline* question (project memory `daily-content-pipeline`) gets resolved — see "Content model" below.

Slice 2 (Supabase content backend) is intentionally **skipped for now**; the daily draws only from bundled puzzles. Image-import / batch authoring is the **Studio** slice, not this one.

### Decisions settled during brainstorming (2026-06-20)

- **A daily is a *single* puzzle per day**, drawn from a varied pool. Size and difficulty are simply *whatever that day's picture is* — variety comes from a varied pool, **not** from authoring a matched set. (Rejected: one-per-size set ≈ 2× authoring burn; rotating size/difficulty by weekday — disliked, and adds no real value.) Rationale: with hand-authoring as the only content source until Studio exists, **burn rate is the constraint**, and single/day is the lowest sustainable burn (a pool of N lasts N days before any repeat).
- **No "free play" as a product concept.** The NYT-crossword model (the north star) has exactly two ways to play: *today's* puzzle and the *archive* of past dailies. There is no random-play mode. The archive is the future "I want more" path (later slices); until it exists, the honest answer is "come back tomorrow."
- **Difficulty is graded, not authored.** `difficultyOf()` already exists; the author draws pictures and the solver labels them forager/woodlander/mycologist.
- **"Today" = the player's local calendar date** (rolls over at local midnight). Correct for a local-only, anonymous app.

## Goals

- Resolve any calendar date to a deterministic daily puzzle (or "none scheduled") via a **pure, clock-free, timezone-free** function.
- **Past-stable scheduling**: a past date's daily never changes, even as new puzzles are appended over future deploys — the precondition that makes a future archive possible.
- `/` becomes the **Daily screen**: today's puzzle with date + streak, same-day board resume, and a cozy completed/caught-up end state.
- **Streak tracking** (calendar-strict) and **today's-completion** + **in-progress board**, persisted in `localStorage` behind a typed, versioned store.
- Seed a starter daily list large enough to give meaningful runway, with content runway made *visible* (list length = days of content).

## Non-goals (explicit YAGNI for this slice)

- No Supabase / data layer; no Studio editor; no image import or batch authoring; no onboarding/landing.
- **No "free play" feature.** The Slice-1 `PlayScreen` over builtins survives only as an **unlinked `/play` dev/QA harness** — not in any nav, not part of the product flow. It quietly retires when the archive ships.
- **No archive/library UI** (browsing or replaying past dailies) — Slices #4/#5. This slice only *writes* the data and preserves the past-stability those slices depend on; it renders no "play a past daily" affordance (just reserves layout room for it).
- No forgiving/grace-day streak, no streak freezes, no longest-streak display beyond what falls out for free (current streak is enough this slice).
- No server-side daily resolution, no timezone selection UI, no cross-device sync (local-only by design).

---

## Architecture

A new pure-logic layer + a thin UI shell over the existing board engine.

```
src/lib/daily/
  list.ts        DAILY_EPOCH constant + DAILY_LIST (ordered, APPEND-ONLY puzzle ids)
  schedule.ts    daysSince(), dailyFor() — pure date→puzzle resolution (no Date, no tz)
  streak.ts      pure streak-state transitions (no storage, no clock)
  store.ts       typed, versioned localStorage read/write + SSR-safe guards
  index.ts       barrel
src/features/daily/
  useDailyState.ts   resolves "today", wires store + streak + the play engine
  DailyScreen.tsx    the daily shell (date, streak, today's state, end states)
  todayDate.ts       local-calendar "today" as "YYYY-MM-DD" (the single clock edge)
src/app/page.tsx        renders <DailyScreen/> (replaces Slice-1 free-play)
src/app/play/page.tsx   renders the existing <PlayScreen puzzles={BUILTINS}/> (unlinked dev harness)
```

**Guiding principle:** all the tricky logic is **pure and clock-free** (`schedule`, `streak`), so it is exhaustively unit-testable. Only `store.ts`, `todayDate.ts`, and the screen touch `localStorage` / `Date`.

### 1. `src/lib/daily/list.ts` — the schedule data

```ts
export const DAILY_EPOCH = "2026-06-22";        // day 0; the first-ever daily
export const DAILY_LIST: readonly string[] = [  // ordered puzzle ids — APPEND-ONLY
  "sprout", "diamond", "toadstool", /* … */
];
```

**The one rule: append-only.** Inserting or reordering shifts every later index and would retroactively change past dailies. Appending never disturbs earlier indices. This is enforced two ways: a doc comment, and a **pinning test** that asserts specific historical `(date → id)` pairs so any reorder fails CI (see Testing). Each id must exist in the bundled puzzle set; a test asserts referential integrity.

### 2. `src/lib/daily/schedule.ts` — deterministic resolution

```ts
daysSince(epoch: string, date: string): number
  // whole calendar days between two "YYYY-MM-DD" strings (UTC-noon math to dodge DST);
  // negative if date < epoch.

type DailyResult =
  | { kind: "puzzle"; puzzleId: string; index: number }   // index = day number ≥ 0
  | { kind: "before-epoch" }                              // date precedes day 0
  | { kind: "none" };                                     // ran off the end of the list

dailyFor(date: string, list = DAILY_LIST, epoch = DAILY_EPOCH): DailyResult
```

`dailyFor` is a **pure string→result function** — no `Date`, no timezone inside it. "What is today" is resolved at the edge (`todayDate.ts`) as the client's **local** calendar date and passed in.

- `i = daysSince(epoch, date)`; `i < 0` → `before-epoch`; `i ≥ list.length` → `none` (the graceful caught-up state); else `puzzle` with `list[i]`.
- Because resolution is `list[i]` (not `list[hash % len]`), **appending to the list cannot change any past or current index** — the past-stability guarantee, and the foundation the archive is built on.

> **Why not `pool[hash(date) % pool.length]`?** It's deterministic only within a single build. The moment a new puzzle is authored and redeployed, `pool.length` changes, the modulo shifts, and *yesterday's daily retroactively becomes a different puzzle* — silently corrupting streaks and any archive. Append-only indexing avoids this by construction.

### 3. `src/lib/daily/streak.ts` — pure streak logic

State persisted (see store): `{ current: number; lastCompleted: string | null }` (`lastCompleted` = "YYYY-MM-DD").

```ts
// Pure: given prior streak state and the date being completed, return next state.
completeDaily(prev: StreakState, date: string): StreakState
```

**Calendar-strict** rule:

- Completing the **same** date again → unchanged (idempotent; re-finishing today doesn't double-count).
- `date` is **exactly one day after** `lastCompleted` → `current + 1`.
- `date` is **more than one day after** `lastCompleted` (a gap), or `lastCompleted` is null → `current = 1` (today starts a fresh streak).
- A separate `currentStreakAsOf(state, today): number` returns `state.current` if `lastCompleted ∈ {today, yesterday}`, else `0` — so a streak displays as broken *as soon as you miss a day*, without needing a write. (Display-only; the stored `current` isn't mutated until the next completion.)

All branches are pure functions of date strings → trivially unit-tested. (NYT-style forgiving/grace-day variants are deliberately deferred; strict is a clean two-date function and can be softened later without data migration.)

### 4. `src/lib/daily/store.ts` — persistence

One versioned `localStorage` key, e.g. `nonagarden.daily.v1`:

```ts
interface DailyStore {
  version: 1;
  streak: { current: number; lastCompleted: string | null };
  today: {                       // the in-progress / completed board for ONE date
    date: string;                // "YYYY-MM-DD"; if it !== today's date, treated as stale → ignored
    puzzleId: string;
    cells: Cell[][];             // serialized board for same-day resume
    completed: boolean;
    elapsedMs: number;           // frozen on completion
  } | null;
}
```

- `loadStore()` / `saveStore()` are **SSR-safe**: guard on `typeof window`, wrap `JSON.parse` in try/catch, and **validate shape + version** on read (any mismatch → return a fresh default rather than throw — corrupt/old data must never crash the daily).
- `today` holds a single date's board; when the player opens the app on a new date, the previous `today` is stale and discarded (its *outcome* already lives in `streak`). Full per-puzzle history is the Archive slice's concern, not this store's.
- The store is the **only** module that reads/writes `localStorage`; `streak.ts` stays pure.

### 5. `src/features/daily/` — UI

**`todayDate.ts`** — `todayLocal(): string` returns the client's local calendar date as `"YYYY-MM-DD"`. The single place `Date` is read for "today."

**`useDailyState(today: string)`** — the wiring hook. It:

- resolves `dailyFor(today)` → today's puzzle (or `none` / `before-epoch`);
- loads the store; if `store.today?.date === today` and ids match, **resumes** that board (cells, completed, elapsed); otherwise starts a fresh board for today's puzzle;
- exposes the board to the existing play engine. **Reuse `usePuzzleGame` with a single-puzzle array** so all paint/keyboard/conflict/win behavior and a11y come for free; the daily shell drives it but hides "New picture" (there is no next — it's *the* daily);
- on each board change, persists `store.today` (debounced/throttled is fine; correctness only needs the latest state saved);
- on **win**, marks `completed`, freezes `elapsedMs`, and applies `completeDaily(streak, today)` once (idempotent), saving the store.

**Hydration / SSR:** the daily cannot be resolved on the server (server tz ≠ player tz, and `localStorage` is client-only). `DailyScreen` therefore resolves `today` and reads the store **only after mount**, rendering a neutral skeleton for the first paint to avoid a hydration mismatch.

**`DailyScreen.tsx`** — the shell around the reused board. States:

- **Pre-mount:** neutral skeleton (no date/streak/board yet).
- **Today has a puzzle, not yet done:** header shows the **date** (e.g. "Monday, June 22") + a **streak chip** (🔥 / leaf-style token-friendly icon, "{n} day streak", hidden or "—" at 0). Below it, the reused `Board` + Fill/Mark + Reset. No "New picture."
- **Resumed in progress:** identical, seeded from the stored board.
- **Completed (today):** a cozy completion card — "Picture complete! It's a {name} — solved in m:ss" — plus streak, and a **"come back tomorrow 🌱"** line. No "Past dailies" control is rendered this slice (the archive doesn't exist yet); the completion-card layout simply leaves room for it, so Slice #5 adds the affordance without reworking the card.
- **Caught up (`none`):** "You're all caught up — no daily scheduled yet. Come back soon 🌱" (the append-only list ran out; an authoring nudge, not an error).
- **Before epoch (`before-epoch`):** treated like "caught up" / "the garden opens {epoch}" — an edge case that effectively never occurs in production but is handled rather than crashing.

#### Accessibility

Inherits the Slice-1 board a11y wholesale (ARIA grid, roving tabindex, live region, non-color cues). New shell pieces:

- The **date** and **streak** are real text, not color/icon-only; the streak chip has an `aria-label` like "Current streak: 4 days".
- The **win announcement** already fires from the board's live region; the shell adds the streak outcome to the cozy card as readable text.
- The completed / caught-up states are plain readable text, fully equivalent without sight.

### Styling / tokens

Reuse the Slice-1 token vocabulary (`bg-board`, `bg-pill`, `text-ink`/`text-ink-soft`, `bg-accent`, radii, Fredoka + mono). The streak chip uses the existing pill styling; no new upstream token needs (the radius/typography follow-ups from `shroomkit-token-followups` are unchanged by this slice).

---

## Content model (resolving the parked pipeline question)

- **Pool, not per-day authoring.** The author fills a backlog *pool* (bundled puzzles) whenever inspired; `DAILY_LIST` is the curated order in which the scheduler hands them out. Authoring cadence is fully decoupled from the daily cadence.
- **Runway is visible.** `DAILY_LIST.length` *is* the days of content before the caught-up state. This makes "can I keep up?" a number, not a surprise.
- **Seeding this slice:** extend the bundled puzzles beyond the current 5 to give a meaningful starter runway (target ≈ **14 days**, i.e. ~14 entries — the existing 5 builtins plus ~9 new hand-authored pictures across 5×5 and 10×10). Every new puzzle is verified with the existing engine: **line-solvable (unique)** via `lineSolve`/`countSolutions`, and graded via `difficultyOf`. A test asserts every `DAILY_LIST` entry resolves to a real, unique puzzle.
- **Future leverage (out of scope, noted):** Studio's image/icon import is the real batch-authoring accelerator; real long-term runway comes from there, not from hand-drawing this slice.

---

## Testing

TDD, logic-first. `pnpm test` / `pnpm typecheck` / `pnpm lint` stay green; `pnpm build` succeeds.

1. **`daysSince` / `dailyFor` (pure):** epoch day = index 0; sequential days increment; `before-epoch` for earlier dates; `none` past the end; **DST-boundary dates** still count whole days correctly. A **pinning test** asserts fixed `(date → puzzleId)` pairs for several known dates — appending to `DAILY_LIST` keeps them green, while any reorder/insert fails (this is the past-stability guard).
2. **`completeDaily` / `currentStreakAsOf` (pure):** consecutive days increment; a one-day gap resets to 1; same-day re-completion is idempotent; `currentStreakAsOf` reports 0 once a day is missed (without mutating stored `current`); null `lastCompleted` starts at 1.
3. **`store` (with a fake/`jsdom` localStorage):** round-trips; **rejects** wrong version / malformed JSON / shape mismatch by returning defaults (never throws); stale `today.date` is ignored.
4. **Content integrity:** every `DAILY_LIST` id exists in the bundled set and resolves to a **unique, line-solvable** puzzle; difficulties grade within the intended range.
5. **`DailyScreen` (component):** with a fixed injected `today`, renders today's puzzle + date + streak; resumes a stored in-progress board; solving it shows the completion card, increments the streak, and persists; the **caught-up** (`none`) and **before-epoch** states render their copy instead of a board; a stored *completed-today* state renders the done card on load (no re-offer). "today" is **injected** into the screen/hook in tests so no clock mocking is needed.

## File layout (new/changed)

```
src/lib/daily/{list.ts, schedule.ts, streak.ts, store.ts, index.ts}
src/lib/daily/{schedule.test.ts, streak.test.ts, store.test.ts, list.test.ts}
src/features/daily/{todayDate.ts, useDailyState.ts, DailyScreen.tsx}
src/features/daily/DailyScreen.test.tsx
src/lib/puzzles/builtins.ts        (extend with ~9 new verified puzzles)
src/app/page.tsx                   (render <DailyScreen/>, replacing free-play)
src/app/play/page.tsx              (new: unlinked dev harness rendering Slice-1 PlayScreen)
```

## Risks / notes

- **Append-only discipline is the whole ballgame.** A careless reorder of `DAILY_LIST` silently rewrites history; the pinning test is the guard rail — keep it and never "fix" it by updating the pins to match a reorder.
- **SSR/hydration.** Today + store are client-only; the skeleton-until-mounted pattern must be honored or the first paint mismatches. Budget review attention here.
- **`usePuzzleGame` reuse.** It currently models a `puzzles[]` with `next()` cycling; driving it with a single-element array and suppressing "New picture" should need no engine change — but verify the reducer's `load`/`next` paths don't assume length > 1. If a small seam is needed, prefer a minimal, tested tweak over forking the engine.
- **Local-date correctness.** `todayLocal()` must use local (not UTC) calendar parts, or the daily rolls over at the wrong hour; covered by deriving "YYYY-MM-DD" from local getFullYear/Month/Date, and by keeping `daysSince` on UTC-noon math internally to avoid DST off-by-one.
- **Content runway is thin until Studio.** A ~14-entry seed buys ~2 weeks; the caught-up state is designed to handle running dry gracefully rather than pretend otherwise.
</content>
</invoke>
