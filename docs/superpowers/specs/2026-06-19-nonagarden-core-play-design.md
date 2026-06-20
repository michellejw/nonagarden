# Nonagarden — Core Play (Slice 1) Design Spec

**Date:** 2026-06-19
**Project:** Nonagarden — the first Shroom Games *web* game (cozy nonogram / Picross).
**Slice:** 1 of N — **Core play**. Seeded from built-in puzzles, no backend.
**Status:** Approved design, ready for implementation plan.

---

## Context

Nonagarden grows out of a claude.ai/design prototype (preserved at `reference/design-handoff/`). The app is already scaffolded — Next.js 16 + React 19 + Tailwind v4 (pnpm) — with the Shroom Games design system wired in via `@shroomgames/tokens` (`file:../shroomkit/tokens/dist`). The smoke-test page proving that integration (`src/app/page.tsx`) is throwaway and gets replaced by the Play screen in this slice.

The full product (decided during brainstorming) is a **hybrid**: hand-authored picture puzzles, a deterministic daily pick, a browsable library, and a local personal archive — with an author-only Studio editor. Players are **anonymous**, progress lives in `localStorage`, and Supabase auth is only ever the author's. None of that is in this slice. See `~/.claude` project memory `nonagarden-decisions` for the full set.

This slice exists to **validate the core mechanic, the feel, and the design-system integration** before any backend or meta-features — exactly the prototype README's recommended build order.

## Goals

- A fully playable single nonogram board, seeded from a handful of built-in puzzles.
- The mechanic ported faithfully from the prototype, but restructured into a **pure, unit-tested logic module** + a **reducer hook** + **presentational components**.
- **Accessibility from the start**: an ARIA grid, full keyboard play, and non-color conflict cues.
- Design-system fidelity: tokens, Fredoka + mono, two themes via the existing `ThemeToggle`.

## Non-goals (explicit YAGNI for this slice)

- No Supabase / data layer, no daily, no library/browse, no archive, no Studio editor, no onboarding/landing.
- No persistence: an in-progress board does **not** survive reload (belongs to the later archive slice).
- No mobile pan/zoom, no 5-cell separators, no grids larger than 10×10, no color puzzles.
- "New picture" simply cycles the built-in puzzles.

---

## Architecture

Three layers, each independently understandable and testable:

```
src/lib/nonogram/         pure logic — no React, no DOM (Vitest unit tests)
src/lib/puzzles/          typed built-in puzzle data
src/features/play/        the reducer hook + presentational React components
src/app/page.tsx          route — renders <PlayScreen/> (replaces smoke test)
```

### 1. `src/lib/nonogram/` — pure logic

Ports the prototype's helpers verbatim in behavior, typed and side-effect-free. Cell values are a small union; a board is a square matrix.

```ts
// types.ts
export type Cell = 0 | 1 | 2;            // 0 empty · 1 filled · 2 marked
export type Grid = Cell[][];
export type Clue = number[];             // run-lengths; [0] for an empty line
export interface Puzzle {
  id: string;
  name: string;                          // the hidden answer, revealed on win
  size: number;                          // N (square; ≤10 this slice)
  rows: string[];                        // length N; '#' filled, '.' empty
}
```

Functions (names mirror the prototype so the port is auditable):

- `clueOf(line: Cell[] | boolean[]): Clue` — run-length encode; `[0]` if empty.
- `solutionOf(puzzle): boolean[][]` — `rows` → boolean solution grid.
- `cluesFor(puzzle): { rowClues: Clue[]; colClues: Clue[] }` — derived from the solution.
- `column<T>(grid: T[][], c: number): T[]` — column extractor.
- `lineSatisfied(marks: Cell[], clue: Clue): boolean` — do the filled runs equal the clue exactly? (Win + "line done".)
- `lineFeasible(marks: Cell[], clue: Clue): boolean` — memoized DP: can this line *still* satisfy the clue given current marks? (Drives the "impossible" flag.)
- `checkWin(cells: Grid, puzzle): boolean` — every row **and** column clue satisfied. **Constraint-based — never compares against the solution grid.** For a uniquely-solvable puzzle this forces the intended picture; all built-ins are authored unique, so the reveal is always honest.
- `emptyGrid(size): Grid`.

This module has **no notion of React, timing, or rendering** — it is the testable core.

### 2. `src/lib/puzzles/builtins.ts`

A typed `Puzzle[]`: the prototype's Toadstool / Heart / Cottage plus a few more authored for variety (5×5 and 10×10). All verified uniquely solvable. `lib/nonogram/solve.ts` holds a `countSolutions(rowClues, colClues, N, cap)` port (bounded DFS, node budget → "unknown"), and a Vitest test asserts every built-in returns exactly one solution. This is the only solver code in the slice; the editor's live uniqueness/difficulty UI is a later slice.

### 3. `src/features/play/` — state + UI

**`usePuzzleGame(puzzles)`** — a hook over `useReducer`. State:

```ts
interface PlayState {
  puzzleIndex: number;
  cells: Grid;
  mode: "fill" | "mark";
  startTs: number | null;   // set on first change
  elapsed: number;          // frozen on win
  won: boolean;
}
```

Actions: `paint(r, c, value)`, `setMode(mode)`, `reset()`, `nextPuzzle()`. The timer is a separate `useEffect` interval that reads `startTs` and stops on `won`; the displayed value is derived, not stored each tick (avoids churning reducer state 4×/sec). `paint` recomputes `won` via `checkWin`; on win it freezes `elapsed`.

Per-render derived values (memoized): `rowClues`, `colClues`, each line's `satisfied` / `impossible` flags, and `hasConflict = any line impossible`.

**Components** (all presentational; data in, callbacks out):

- **`PlayScreen`** — composition + layout. Header (eyebrow `NONOGRAM`, `N × N` title, timer pill, `ThemeToggle`), `Board`, footer (Fill/Mark segmented control, `Reset` ghost, `New picture` secondary), conflict hint line, and on win a **ResultCard** ("Picture complete!" / "It's a {name} — solved in m:ss" / `New picture` · `Play again`).
- **`Board`** — the three aligned CSS grids (top clue band, left clue gutter, cell grid) sharing one `--cell` size + `--gap` so clues line up with rows/columns. Gutter/band sized to the longest clue.
- **`ClueLine`** — renders a row/column clue: mono numerals, state `normal` / `satisfied` (dim) / `impossible`. Impossible uses the terracotta token **plus** a non-color cue (a small caret/underline) so it isn't color-only.
- **`Cell`** — a single tile button.

#### Accessibility model

- The cell grid is `role="grid"`; each row `role="row"`; each cell a real `<button role="gridcell">`.
- **Roving tabindex**: exactly one cell is tab-focusable; arrow keys move focus across the grid (and update the roving index). Home/End jump to row ends (stretch: Ctrl+Home/End to grid corners).
- Keys: **Space/Enter** = fill-toggle (respects current mode → in mark mode, toggles a mark), **`x`** = mark-toggle regardless of mode. This mirrors the pointer model (left = mode action, right-click = mark).
- Each cell's `aria-label` states position + state, e.g. *"Row 3, column 4, empty"* / *"…, filled"* / *"…, marked"*.
- A visually-hidden `aria-live="polite"` region announces conflict state transitions ("A clue can't be satisfied yet") and the win ("Picture complete — it's a toadstool"), so the experience is equivalent without color or sight of the board.
- Clue satisfied/impossible state is conveyed by text/icon, not color alone.

#### Interaction (pointer)

- **Pointer Events** (not mouse-only): `pointerdown` on a cell sets the drag value from that cell's current state and applies it; `pointerenter` while a drag is active applies the same value (drag to paint a line); a window `pointerup` ends the drag. `contextmenu` is suppressed on the board; a secondary/right press toggles a mark. Touch gets basic taps for free; full touch (pan/zoom, frozen gutters) is a later slice.
- Tiles: filled = `--shroom-accent` with `inset 0 -3px 0 rgba(0,0,0,.2)` lip; empty/marked = `--tile-revealed` with a 1px inset edge; marked shows `×` in `--text-soft`. Press feedback `transform: scale(.86)` on `:active`. **Only `transform` is transitioned**, never background/box-shadow (stale-color bug when the theme var changes — documented in the prototype).
- Cell sizing: ≤5 → 46px, ≤10 → 34px; gap 5px. (Larger sizes are a later slice.)

### Styling / tokens

Tailwind utilities from `@shroomgames/tokens` (`bg-board`, `bg-pill`, `text-ink`, `text-ink-soft`, `bg-accent`, `text-on-accent`, radii). Accent tiles, the inset lip, and the 9px tile radius use raw vars / literals (tile radius `9px` is a local literal — the token scale lacks 9/20/28; tracked as an upstream follow-up in `shroomgames-meta`). Mono numerals via `font-mono`; UI via Fredoka (`--font-display`). The existing `src/components/ThemeToggle.tsx` is reused unchanged.

---

## Testing

Add **Vitest** + **@testing-library/react** + jsdom (not in the scaffold). Two tiers:

1. **Logic (TDD, write first):** `clueOf`, `lineSatisfied`, `lineFeasible` (including the empty-line and impossible cases), `cluesFor`, `checkWin` (win only when all rows+cols satisfied; a wrong-but-plausible fill does *not* win a unique puzzle). Plus a **uniqueness assertion over every built-in puzzle**.
2. **Interaction:** render `PlayScreen`; simulate a pointer paint sequence that solves the smallest built-in and assert the win card appears with the right name/time; simulate keyboard play (arrow + space) for one line and assert state; assert conflict `aria-live` text appears when a line is made impossible.

`pnpm test` runs the suite; `pnpm typecheck` (tsc `--noEmit`) and `pnpm lint` stay green.

## File layout (new/changed)

```
src/lib/nonogram/{types.ts, clues.ts, lines.ts, win.ts, solve.ts, index.ts}
src/lib/nonogram/*.test.ts
src/lib/puzzles/builtins.ts
src/features/play/{usePuzzleGame.ts, PlayScreen.tsx, Board.tsx, ClueLine.tsx, Cell.tsx, format.ts}
src/features/play/PlayScreen.test.tsx
src/app/page.tsx            (replace smoke test with <PlayScreen/>)
vitest.config.ts, test setup
```

## Risks / notes

- **Win on a non-unique board would mis-reveal the name.** Mitigated here because all built-ins are authored unique and a test enforces it; the general guard ("refuse to save non-unique") belongs to the Studio slice.
- **a11y is the main new surface vs the prototype.** Roving-tabindex grid + live region are the pieces to get right; budget review time there.
- **Pointer Events on desktop must keep the exact drag-paint feel** of the prototype (value latched on `pointerdown`).
```
