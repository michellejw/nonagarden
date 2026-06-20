# Handoff: Cozy Nonogram (game + authoring tool)

## Overview
A nonogram (picture-cross / Picross) web app in a warm, rounded, "cozy" visual style, plus a developer authoring tool for creating valid puzzles. Two screens:

1. **Game** — play a puzzle: fill/mark cells, drag to paint, live clue feedback, win on solve. The puzzle's name is a hidden surprise revealed only when solved.
2. **Editor (Puzzle Studio)** — draw a picture on a grid; clues generate live; an automatic solver reports whether the puzzle is **uniquely solvable** and an **auto-detected difficulty**; save to a library; test-play; JSON backup/import.

The two share a puzzle **library** (storage). Anything saved in the Editor immediately appears in the Game.

## About the design files
The files in `prototypes/` are **design references created as HTML** (Design Components — a small streaming-template runtime). They show the intended **look, copy, and behavior**. They are **not** the production codebase. The task is to **recreate these designs in your target stack** (you mentioned **Next.js on Vercel + Supabase**) using its patterns — not to ship the HTML directly. The logic (solver, difficulty, win detection) is plain JavaScript and can be ported almost verbatim.

To run the prototypes as-is for reference, open them inside this design project (they depend on the bound "Shroom Games" design-system bundle under `_ds/`). They are not standalone.

## Fidelity
**High-fidelity.** Final colors, typography, spacing, radii, motion, and interactions are all intentional. Recreate pixel-faithfully, but using your codebase's component primitives. The visual language is the **Shroom Games Design System** (rounded, soft, two themes); tokens are listed below.

---

## Screens / Views

### 1. Game
- **Purpose:** Solve a hidden-picture nonogram.
- **Layout:** Centered column on a full-bleed `--surface-app` background.
  - **Header row** (space-between): left = eyebrow `NONOGRAM` + big size title (e.g. `10 × 10`); right = a timer pill + Light/Dark segmented toggle.
  - **Puzzle:** column-clue band on top, row-clue gutter on the left, board grid. Built with three aligned CSS grids that share the cell size + gap so clues line up with columns/rows. Left gutter and top band widths grow with the longest clue in the puzzle.
  - **Footer row** (space-between): Fill/Mark segmented control (left); `Reset` (ghost) + `New picture` (secondary) buttons (right).
  - **Conflict hint:** a small terracotta line appears under the board when a clue is currently impossible.
  - **Win:** a `ResultCard` rises in below the board: title "Picture complete!", subtitle "It's a {name} — solved in {m:ss}.", actions `New picture` / `Play again`.
- **Cells:**
  - Filled = `--accent` background with a 3px inset bottom "lip" (`inset 0 -3px 0 rgba(0,0,0,.2)`). (Accent rather than the DS sage tile so filled cells stay clearly visible in **both** light and dark.)
  - Empty/unknown = `--tile-revealed` with a 1px inset hairline `--tile-revealed-edge`.
  - Marked = same as empty with a `×` glyph in `--text-soft`.
  - Radius `--radius-tile` (9px). Press feedback: `transform: scale(.86)` on `:active`.
  - **Do not** CSS-transition `background`/`box-shadow` on cells — only `transform`. (Transitioning background holds stale colors when the theme variable changes; transition transform only.)
- **Cell sizing:** 5×5 → 46px, ≤10 → 34px, else 26px; gap 5px (≤10) / 4px.
- **Clue numbers:** mono font, 14px, `--fw-semibold`. Color: normal `--text-strong`; line satisfied → dim (`--text-soft`, opacity .4); line impossible → `--mushroom-cap`. A `[0]`/empty line shows no number.

### 2. Editor (Puzzle Studio)
- **Purpose:** Author valid puzzles without touching code/files.
- **Layout:** Header (eyebrow `PUZZLE STUDIO` + title "Nonogram Editor", Light/Dark toggle). Two columns:
  - **Left:** size segmented (5×5 / 10×10 / 15×15) + `Invert` / `Clear`; the drawing grid with live clues (same grid system as the Game); helper text.
  - **Right sidebar (340px):**
    - **Solvability banner** — states: Empty / Checking… / **Uniquely solvable** (greenish `--shroom-card-sel`, check icon) / **Multiple solutions** (warn) / Too intricate to auto-verify.
    - **Details card** — Title input (with "hidden until solved" helper), **Difficulty · auto** badge (colored dot + label + one-line explanation), Filled count.
    - **Test play** (secondary) + **Save/Update** (primary) buttons.
    - **Library card** — count, `+ New`, scrollable list of saved puzzles; each row = SVG thumbnail + title + `{size} · {difficulty}` + delete ×. Clicking a row loads it; the active one is highlighted.
    - **JSON card** — Copy / Download / paste-to-import.
  - **Test-play overlay:** a modal that plays the current draft using the Game's exact mechanics, with a "Solved! This puzzle plays cleanly." confirmation.

---

## Interactions & behavior
- **Painting (both screens):** `mousedown` sets a drag value based on the cell's current state; `mouseenter` while dragging applies it (drag to paint a line). `mouseup` (window) ends the drag. Right-click toggles a mark; `contextmenu` is suppressed on the board.
- **Game validation is constraint-based, never solution-peeking.** A fill is left exactly as placed; the game never auto-corrects against the hidden answer. A clue only flags (turns terracotta) when that row/column becomes **impossible** given current marks. **Win = every row and every column clue is satisfied** (so for a uniquely-solvable puzzle the picture is forced).
- **Timer:** starts on first cell change, frozen value shown on win.
- **Theme:** `data-theme="forest" | "twilight"` on the root wrapper recolors everything via CSS variables. NOTE: the DS only declares its semantic aliases (`--surface-app`, `--accent`, `--text-strong`, …) in the forest block, so when scoping dark mode to a wrapper (not `:root`) you must re-declare those aliases under `[data-theme="twilight"]` pointing at the `--shroom-*` twilight primitives. (See the `<style>` block in either prototype.)
- **Motion:** press `scale` ~.06s; result card uses the DS `shroom-rise`. Standard ease `cubic-bezier(.22,.61,.36,1)`.

## State
**Game:** `pics` (defaults + library), `pi` (index), `cells` (N×N of 0 empty / 1 filled / 2 marked), `mode` 'fill'|'mark', `theme`, `startTs`, `won`, `elapsed`.
**Editor:** `size`, `grid` (N×N 0/1 solution), `title`, `solve` `{state, difficulty}`, `library`, `currentId`, `testing`+`play`, plus import/copy/save flags.

## The solver (port this) — in the Editor prototype
- `clueOf(line)` → run-length clue (`[0]` for empty).
- `lineFeasible(marks, clue)` — memoized DP: can this line still satisfy the clue given marks (1 filled / 2 known-empty / 0 unknown)? Used for the "impossible clue" flag.
- `lineSatisfied(marks, clue)` — do the filled runs equal the clue exactly? Used for win + "line done".
- `arrangements(clue, N)` — every placement of a line as 1/2 array. Used by the next two.
- **Uniqueness:** `countSolutions(rowClues, colClues, N, cap=2)` — DFS placing one row-arrangement at a time, pruning with per-column `lineFeasible`, counting up to 2 full solutions (node budget caps runaway cases → "unknown"). `count <= 1` ⇒ unique.
- **Auto difficulty:** `assessDifficulty()` runs pure **line-solving** propagation (intersect all line arrangements consistent with current knowns; apply forced cells; iterate to fixpoint). If it does **not** fully solve ⇒ `mycologist` (needs guessing). Otherwise by number of propagation rounds: ≤2 `forager`, ≤5 `woodlander`, else `mycologist`. Consider running this server-side (Vercel function) at save time and storing `difficulty` + `unique_solution`.

## Design tokens (Shroom Games DS)
- **Type:** Fredoka (400/500/600/700; 600 is the workhorse) for UI; a mono stack (`ui-monospace, 'SF Mono', Menlo`) for numerals (clues, timer). Eyebrow labels 11px uppercase, +1.3px tracking.
- **Radii:** tile 9 · chip 12 · pill 14 · button/card 16 · banner 18 · board 20 · sheet 28.
- **Forest (light):** app `#F3EFE4` · board `#ECE6D6` · pill `#EAE4D4` · card `#FBF9F1` · card-sel `#EFF2E2` · border `#E1DBC9` · text `#3A3D30` · text-soft `#8C8C74` · **accent `#6E8B4E`** · tile-revealed `#FBF9F1` / edge `#E8E2D0` · warn (mushroom-cap) `#C5603F` · num-5 (amber) `#B8893B`.
- **Twilight (dark):** app `#161B22` · board `#10151B` · pill `#222A34` · card `#1E2630` · card-sel `#22302E` · border `#2B3440` · text `#E7EAEE` · text-soft `#7E8893` · **accent `#6FBFA8`** · tile-revealed `#1B212A` / edge `#262E38` · warn `#E0B25A`.
- **No emoji.** Warmth comes from the rounded type + soft shapes.

## Storage / backend (your stack: Supabase + Vercel)
- The prototypes use **browser localStorage** under the key `nonogram_library` as a stand-in database, behind a 3-function seam: `listPuzzles / savePuzzle / deletePuzzle`.
- `data_layer.example.js` gives both the local implementation and a **drop-in Supabase implementation** with the same shapes — switching is a one-line `store` swap.
- `supabase_schema.sql` defines the `puzzles` table + RLS (public read, owner-only write). Run it in the Supabase SQL editor.
- Suggested split: **editor writes** require auth (you), **game reads** are public. Run the uniqueness/difficulty check in a Vercel serverless route on save so clients can't store broken puzzles.

## Files
- `prototypes/Nonogram Game.dc.html` — the play screen + game logic.
- `prototypes/Nonogram Editor.dc.html` — the authoring tool + solver/difficulty + library.
- `supabase_schema.sql` — Postgres table + RLS.
- `data_layer.example.js` — storage seam (local + Supabase).

## Suggested build order
1. Port the solver/clue/win helpers (pure JS) into a `lib/nonogram.ts`.
2. Build the Game screen from defaults (no backend) to validate mechanics.
3. Stand up Supabase (`supabase_schema.sql`), wire `data_layer` `remote`.
4. Build the Editor; run uniqueness/difficulty server-side at save.
5. Add a browse/library screen for the Game (cycling doesn't scale past a handful) — not yet designed.

## Roadmap — larger grids, color, mobile (not yet designed; plans below)

These are intentionally deferred. Notes here are the agreed direction so design + build can pick them up without re-deciding.

### A. Larger grids (20×20, 25×25+)
- **Rendering:** keep the adaptive cell size (shrink toward ~18–22px); the existing 3-grid alignment scales fine. Past ~30×30 consider windowing, but it's likely unnecessary up to 25.
- **Readability:** add the classic **bold separator every 5 cells** (light at 10×10, essential at 20+). Implement as a heavier gap/line on each 5th boundary, applied to the board *and* the clue gutters so they stay aligned — don't break the shared cell metric.
- **Solver cost is the real constraint.** `arrangements()` / `countSolutions()` already cap with a node budget and report "unknown" — at large sizes that'll trigger often. Plan: move **uniqueness + difficulty checking server-side** (Vercel function) with a proper line-solver + bounded backtracking and a hard timeout, then **store** `unique_solution` + `difficulty` on the row (don't recompute on read). Optionally run it in a **Web Worker** in the editor so the canvas never blocks.
- **Difficulty calibration:** the round-count thresholds (≤2 / ≤5) were tuned at 10×10. Recalibrate per size, or normalize by grid area.
- Large boards can exceed the viewport → this is where pan/zoom (section C) becomes necessary even on desktop; add a "fit to screen" zoom control.

### B. Color nonograms
- **Data model:** cells become a **color index** (0 = empty, 1..K = palette slot) instead of a boolean. `rows` stays an array of equal-length strings but each char is a palette key; add a **`palette jsonb`** column (array of hex). Backward-compatible: a 1-color palette === today's puzzles.
- **Clue rules change (this is the bulk of the work):** each clue entry is `{count, color}`. Two runs of the **same** color need a gap between them; two runs of **different** colors may sit **adjacent** with no gap. Every solver helper must become color-aware: `clueOf`, `arrangements`, `lineFeasible`, `lineSatisfied`, and `countSolutions`. The structure of each stays the same; the adjacency/gap test is what generalizes.
- **UI:** clue numbers render **in their run's color**; the editor gets a **palette editor** (add/remove/reorder colors, seeded from DS-friendly hues) and an **active-color selector** (plus eyedropper); painting lays down the active color; filled cells keep the 3px lip. Marks (×) still mean "known empty." Win = each line's colored run sequence matches.
- Keep the palette small (≈2–5) for solvability and visual clarity.

### C. Mobile (touch + pan/zoom)
- **Core tension:** precise per-cell tapping and drag-paint vs. panning a board bigger than the screen. Resolve with an explicit tool model rather than guessing intent.
- **Surface:** wrap the board in a **pinch-zoom + drag-pan** container; lock page scroll while a touch is on the board. Provide on-screen **zoom + "fit"** controls.
- **Interaction model (recommended):** a thumb-reachable **bottom toolbar** with a Paint/Pan toggle and the Fill/Mark switch. In **Paint**, one finger drags to paint a line, two fingers pan/zoom. In **Pan**, one finger moves the board. (Alternative: always one-finger-paint, two-finger-pan, no toggle — test which feels better.)
- **Frozen clue gutters:** as the board pans/zooms, the **row clues track vertical position and column clues track horizontal position** (spreadsheet-style frozen panes) so clues for the visible cells are always on screen. This is the make-or-break UX detail.
- **Targets & forgiveness:** rely on zoom to reach ≥44px effective targets; minimum on-screen cell ~28–32px. Add **undo/redo** (touch misfires are common) and consider an **auto-cross completed lines** toggle to cut tedium on big boards.
- Likely a distinct responsive layout, not just a reflow of the desktop screen — design it as its own pass.

### D. Also planned
- Puzzle **browse/library screen** for players (cycling via "New picture" doesn't scale past a handful — needs a grid of thumbnails, filter by size/difficulty, completed-state).
