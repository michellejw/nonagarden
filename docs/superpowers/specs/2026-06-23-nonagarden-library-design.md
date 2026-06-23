# Nonagarden — Library / Browse (Slice #4) — Design

**Date:** 2026-06-23
**Status:** Approved (brainstorming)
**Slice:** #4 Library / browse — the fourth content surface, after Core Play (#1), Daily (#3), Supabase content backend (#2), and Studio v1 (#6).

## Purpose

Players can currently only ever see **one puzzle per day** (the Daily), even though the published pool holds ~20 hand-authored puzzles. The Library unlocks the rest of the catalog for free, un-date-gated play, and turns the pool into a browsable **collection wall** — the immediate payoff for the Studio authoring pipeline. It also establishes a **completion ledger** that the Archive slice (#5) will reuse.

## Decisions (locked during brainstorming)

1. **Scope:** the Library shows all `status=published` puzzles **except those scheduled as future dailies** (strictly later schedule position than today's). Past dailies, today's daily, and unscheduled pool puzzles are all browsable. Rationale: no "playing ahead" to spoil the Daily, while everything else is fair game.
2. **Spoiler treatment — collection wall:** uncleared puzzles render as a neutral tile (name + size + difficulty badge, **no picture**). Cleared puzzles reveal the solved picture as a mini thumbnail. Names stay visible throughout. The wall doubles as a motivation hook.
3. **Persistence:** two new localStorage stores — a **completion ledger** (set of cleared puzzle ids) and a **per-puzzle in-progress board** map (auto-save & resume). Kept separate from the daily store.
4. **Coherence:** completing the **Daily** also writes the puzzle id into the completion ledger, so a puzzle solved as a past daily shows as cleared on the Library wall. (Small hook in the daily's existing `onWin`.)
5. **Navigation:** a minimal shared **app header** (wordmark + Daily / Library links + theme toggle) rendered in the root layout. Routes: `/library` (browse), `/library/[slug]` (play). The Daily stays at `/`.
6. **Organization:** the browse grid is grouped by grid size; each tile shows a difficulty badge + cleared/locked state; an "X / N cleared" counter sits above the grid. No filter/sort controls in v1.
7. **Play-surface approach (A):** a new `LibraryPlayScreen` + thin board wrapper reuse the existing `usePuzzleGame` + `Board` engine, mirroring how `DailyScreen` wires the daily store. No changes to working daily/core-play code beyond the one ledger hook.

## Architecture

### Data model & persistence (client-side, localStorage)

**`nonagarden.cleared.v1` — completion ledger** (`src/lib/library/cleared.ts`, pure)
```ts
interface ClearedStore {
  version: 1;
  ids: string[]; // puzzle uuids ever cleared, deduped
}
// loadCleared(): ClearedStore
// recordCleared(id: string): ClearedStore   // dedupes, persists, returns next
// isCleared(store: ClearedStore, id: string): boolean
```
This is the ledger the Archive slice (#5) will reuse; the Library is its first consumer.

**`nonagarden.library.v1` — in-progress boards** (`src/lib/library/store.ts`, pure)
```ts
interface LibraryStore {
  version: 1;
  boards: Record<string, {        // keyed by puzzle id
    cells: Cell[][];
    completed: boolean;
    elapsedMs: number;
  }>;
}
// loadLibraryStore(): LibraryStore
// saveBoard(id, snap): LibraryStore   // persists, returns next
// boardFor(store, id): board | undefined
// dropBoard(id): LibraryStore         // remove on clear — bounds storage
```
Only boards with real progress are stored; a board entry is dropped once its puzzle enters the ledger (the revealed thumbnail comes from the solution, not the saved board). Both modules follow the daily store's exact conventions: type guards, `defaultStore()`, silent-fail on quota, SSR-safe (`typeof window === "undefined"`).

### Content fetch (server + pure mapping)

New in `src/lib/content/content.ts` (siblings to the daily functions):

- `fetchLibraryContent(client?)` — selects `id, name, size, rows, slug, difficulty` from `puzzles` where `status='published'`, plus the full `daily_schedule`. Injectable client for tests; defaults to the publishable-key read client. Errors propagate (honest error, not fake-empty) — consistent with `fetchDailyContent`.
- `mapLibraryContent(puzzleRows, scheduleRows, todayPosition)` — pure. Returns the **library set**: published puzzles minus those whose schedule position is **strictly greater than `todayPosition`**. Boundary: position == today stays in; position == today+1 is excluded. Unscheduled puzzles (never in the schedule) are always included.

`todayPosition` is derived client-side from the same epoch/`dailyFor` math the Daily already uses (the server can't know the player's timezone), so the page fetches the full set + schedule and the client filters out the future — mirroring the Daily's existing "server sends everything, client resolves locally" flow.

### Routes & components

- `src/components/AppHeader.tsx` — shared chrome: "Nonagarden" wordmark, `Daily` / `Library` nav links, and the `ThemeToggle` (lifted out of the per-screen headers). Rendered in `layout.tsx`. Daily/Play screen headers drop their inline toggle.
- `/library` → `src/app/library/page.tsx` (Server Component, ISR `revalidate=3600`) → `fetchLibraryContent()` → `LibraryScreen` (client).
- `src/features/library/LibraryScreen.tsx` (client) — resolves `todayPosition`, filters the future via `mapLibraryContent` semantics, groups the set by size, renders `PuzzleTile`s, reads the ledger to decide each tile's state, shows the "X / N cleared" counter. Client-only store reads happen after mount (same hydration-safety pattern as `DailyScreen`).
- `src/features/library/PuzzleTile.tsx` — neutral locked tile (name + size + difficulty badge) when uncleared; mini revealed-picture render when cleared. Links to `/library/[slug]`.
- `src/components/DifficultyBadge.tsx` — per-difficulty colored badge (forager / woodlander / mycologist). Shared so the Studio gallery can adopt it, closing the noted cosmetic gap.
- `/library/[slug]` → `src/app/library/[slug]/page.tsx` (Server Component) → `LibraryPlayScreen` (client). Unknown/unpublished slug, or a slug that maps to a future daily, → `notFound()` (404).
- `src/features/library/LibraryPlayScreen.tsx` (client) — resolves the puzzle by slug; wires `usePuzzleGame` with `initial` (from `nonagarden.library.v1`), `onChange` (autosave), and on-win → `recordCleared(id)` + `dropBoard(id)`. Win card offers **Play again** (replay allowed) + **Back to library**.

### Daily coherence hook

`DailyScreen`'s existing `onWin` (which already calls `setStore` for the streak) gains one line: `recordCleared(puzzle.id)`. Keyed by the same uuid the Library reads. No other daily changes.

## Data flow

1. Server `page.tsx` fetches all published puzzles + full schedule (ISR-cached ~hourly).
2. Client `LibraryScreen` resolves `todayPosition`, drops future-scheduled puzzles, groups remaining by size.
3. Grid renders against the ledger — locked tiles vs revealed thumbnails; counter reflects cleared/total.
4. Tile → `/library/[slug]` → `LibraryPlayScreen` resumes any saved board (or starts fresh), autosaves on every change.
5. On win → ledger records the id, in-progress board dropped, win card shown.
6. Returning to `/library` shows the now-revealed tile + bumped counter.

## Error handling & edge cases

- **Unknown / unpublished / future-daily slug** at `/library/[slug]` → `notFound()` (404). Future-daily 404 keeps "no playing ahead" consistent.
- **Empty library** (everything is a future daily, or no published content) → friendly empty state ("The library's still growing 🌱").
- **DB fetch error** → throw (honest error, not fabricated content), matching `fetchDailyContent`.
- **Ledger / board corruption or quota** → type-guarded loads fall back to defaults; saves fail silently; game continues in-memory.
- **Replaying a cleared puzzle** → starts a fresh board; the ledger stays cleared (no un-clearing); fresh in-progress board saved under the same id, dropped again on the next win.
- **Today's daily in the library** → daily and library boards live in independent stores (`daily.v1` vs `library.v1`); no cross-contamination. Playing today's puzzle in the library is allowed; only the future is hidden.

## Testing (TDD — pure logic first)

- `cleared.ts` — record/dedup/isCleared; version guard; SSR + quota fallback.
- `library/store.ts` — save/load/boardFor/dropBoard; guards; fallback.
- `mapLibraryContent` — future-daily exclusion boundary (position == today included, today+1 excluded); unscheduled included; size-grouping; empty result.
- `fetchLibraryContent` — injected fake client (mirrors the `fetchDailyContent` test); error propagation.
- Component tests — `PuzzleTile` cleared vs locked render; `LibraryScreen` counter + grouping + ledger-driven state; `LibraryPlayScreen` resume-from-saved, autosave-on-change, win → ledger + dropBoard, replay; `AppHeader` links/active state.
- Merge gate — tests + typecheck + lint + prod build all green (the established bar).

## Non-goals (v1) — recorded future doors

Filter/sort controls, search, pagination, hidden-until-cleared names, per-difficulty leaderboards, and server-side cleared sync are all out of scope for v1. The completion ledger is intentionally shaped to be reused by Archive (#5).
