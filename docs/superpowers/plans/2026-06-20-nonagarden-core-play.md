# Nonagarden — Core Play (Slice 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fully playable, accessible single-board nonogram seeded from built-in puzzles, with the mechanic ported from the design prototype into a pure logic module + reducer hook + presentational components.

**Architecture:** `src/lib/nonogram/` holds pure, DOM-free logic (clue/feasibility/win/solver) unit-tested with Vitest. `src/lib/puzzles/` holds typed built-in puzzles. `src/features/play/` holds a `useReducer`-based game hook and presentational React components (`PlayScreen` → `Board` → `Cell`/`ClueLine`). The Play screen renders at `/`, replacing the smoke-test page.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · `@shroomgames/tokens` · Vitest + Testing Library.

## Global Constraints

- **Cell encoding:** `0` empty · `1` filled · `2` marked. Type `Cell = 0 | 1 | 2`.
- **Win is constraint-based:** win iff every row AND column clue is satisfied (`lineSatisfied`). NEVER compare the board to the solution grid.
- **Puzzle row format:** `rows: string[]`, length `size`, chars `#` (filled) / `.` (empty).
- **Grids this slice are ≤ 10×10.** Cell size: `size <= 5 ? 46 : 34` px; gap `5` px.
- **Tile radius is `9px`** (local literal — the token scale lacks 9; tracked upstream). Filled tile = `var(--shroom-accent)` + `box-shadow: inset 0 -3px 0 rgba(0,0,0,.2)`. Empty/marked = `var(--tile-revealed)` + `box-shadow: inset 0 0 0 1px var(--tile-revealed-edge)`.
- **Only transition `transform` on cells** — never `background`/`box-shadow` (stale-color bug on theme change).
- **Accessibility is required**, not optional: ARIA grid, roving-tabindex keyboard nav, non-color conflict cue, `aria-live` announcements.
- **No persistence:** in-progress boards do not survive reload.
- **Package manager is pnpm.** Conventional-commit messages.

---

### Task 1: Test tooling (Vitest + Testing Library)

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/test/sanity.test.ts`
- Modify: `package.json` (devDependencies + scripts)

**Interfaces:**
- Produces: a working `pnpm test` / `pnpm test:run` / `pnpm typecheck`; jsdom env; `@/*` alias resolves in tests; a `PointerEvent` polyfill for jsdom.

- [ ] **Step 1: Install dev dependencies**

Run:
```bash
pnpm add -D vitest@^3 @vitejs/plugin-react@^4 jsdom@^25 vite-tsconfig-paths@^5 \
  @testing-library/react@^16 @testing-library/dom@^10 @testing-library/jest-dom@^6 @testing-library/user-event@^14
```
Expected: packages added; if pnpm prints `Ignored build scripts`, none here require builds — ignore.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
```

- [ ] **Step 3: Create `src/test/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";

// jsdom lacks PointerEvent; Testing Library's pointer helpers need it.
if (typeof window !== "undefined" && !("PointerEvent" in window)) {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
    }
  }
  // @ts-expect-error assigning polyfill
  window.PointerEvent = PointerEventPolyfill;
}
```

- [ ] **Step 4: Add scripts to `package.json`**

In the `"scripts"` object add:
```json
"test": "vitest",
"test:run": "vitest run",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 5: Write a sanity test** — `src/test/sanity.test.ts`

```ts
import { describe, it, expect } from "vitest";

describe("test tooling", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run it**

Run: `pnpm test:run`
Expected: 1 passed.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: add vitest + testing-library tooling"
```

---

### Task 2: Core types + grid helpers

**Files:**
- Create: `src/lib/nonogram/types.ts`
- Create: `src/lib/nonogram/grid.ts`
- Create: `src/lib/nonogram/grid.test.ts`

**Interfaces:**
- Produces: `type Cell = 0|1|2`, `type Grid = Cell[][]`, `type Clue = number[]`, `interface Puzzle { id; name; size; rows }`; `emptyGrid(size): Grid`; `column<T>(grid, c): T[]`.

- [ ] **Step 1: Write the failing test** — `src/lib/nonogram/grid.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { emptyGrid, column } from "./grid";

describe("emptyGrid", () => {
  it("makes an N×N grid of zeros", () => {
    expect(emptyGrid(3)).toEqual([
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
  });
  it("does not share row references", () => {
    const g = emptyGrid(2);
    g[0][0] = 1;
    expect(g[1][0]).toBe(0);
  });
});

describe("column", () => {
  it("extracts a column", () => {
    expect(column([[1, 2], [3, 4]], 1)).toEqual([2, 4]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:run src/lib/nonogram/grid.test.ts`
Expected: FAIL — cannot find module `./grid`.

- [ ] **Step 3: Create `src/lib/nonogram/types.ts`**

```ts
export type Cell = 0 | 1 | 2; // 0 empty · 1 filled · 2 marked
export type Grid = Cell[][];
export type Clue = number[]; // run-lengths; [0] for an empty line

export interface Puzzle {
  id: string;
  name: string; // hidden answer, revealed on win
  size: number; // square; ≤10 this slice
  rows: string[]; // length size; '#' filled, '.' empty
}
```

- [ ] **Step 4: Create `src/lib/nonogram/grid.ts`**

```ts
import type { Cell, Grid } from "./types";

export function emptyGrid(size: number): Grid {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 0 as Cell),
  );
}

export function column<T>(grid: ReadonlyArray<ReadonlyArray<T>>, c: number): T[] {
  return grid.map((row) => row[c]);
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm test:run src/lib/nonogram/grid.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: nonogram core types + grid helpers"
```

---

### Task 3: Clues (`clueOf`, `solutionOf`, `cluesFor`)

**Files:**
- Create: `src/lib/nonogram/clues.ts`
- Create: `src/lib/nonogram/clues.test.ts`

**Interfaces:**
- Consumes: `Puzzle`, `Clue` (types), `column` (grid.ts).
- Produces: `clueOf(line): Clue`; `solutionOf(puzzle): boolean[][]`; `cluesFor(puzzle): { rowClues: Clue[]; colClues: Clue[] }`.

- [ ] **Step 1: Write the failing test** — `src/lib/nonogram/clues.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { clueOf, solutionOf, cluesFor } from "./clues";
import type { Puzzle } from "./types";

describe("clueOf", () => {
  it("encodes run lengths", () => {
    expect(clueOf([true, true, false, true])).toEqual([2, 1]);
  });
  it("returns [0] for an empty line", () => {
    expect(clueOf([false, false])).toEqual([0]);
    expect(clueOf([])).toEqual([0]);
  });
  it("treats numeric 1 as filled", () => {
    expect(clueOf([1, 0, 1, 1])).toEqual([1, 2]);
  });
});

const tee: Puzzle = { id: "t", name: "Tee", size: 3, rows: ["###", ".#.", ".#."] };

describe("solutionOf / cluesFor", () => {
  it("maps rows to booleans", () => {
    expect(solutionOf(tee)[1]).toEqual([false, true, false]);
  });
  it("derives row and column clues", () => {
    const { rowClues, colClues } = cluesFor(tee);
    expect(rowClues).toEqual([[3], [1], [1]]);
    expect(colClues).toEqual([[1], [3], [1]]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:run src/lib/nonogram/clues.test.ts`
Expected: FAIL — cannot find module `./clues`.

- [ ] **Step 3: Create `src/lib/nonogram/clues.ts`**

```ts
import type { Clue, Puzzle } from "./types";
import { column } from "./grid";

// Counts truthy entries as filled. Used on solution (boolean) / author (0|1) lines,
// never on a player's marks (use lineSatisfied/lineFeasible for those).
export function clueOf(line: ReadonlyArray<number | boolean>): Clue {
  const res: number[] = [];
  let run = 0;
  for (const v of line) {
    if (v) run++;
    else if (run) {
      res.push(run);
      run = 0;
    }
  }
  if (run) res.push(run);
  return res.length ? res : [0];
}

export function solutionOf(puzzle: Puzzle): boolean[][] {
  return puzzle.rows.map((r) => r.split("").map((ch) => ch === "#"));
}

export function cluesFor(puzzle: Puzzle): { rowClues: Clue[]; colClues: Clue[] } {
  const sol = solutionOf(puzzle);
  const rowClues = sol.map((row) => clueOf(row));
  const colClues: Clue[] = [];
  for (let c = 0; c < puzzle.size; c++) colClues.push(clueOf(column(sol, c)));
  return { rowClues, colClues };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:run src/lib/nonogram/clues.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: nonogram clue generation"
```

---

### Task 4: Lines (`lineSatisfied`, `lineFeasible`, `lineState`)

**Files:**
- Create: `src/lib/nonogram/lines.ts`
- Create: `src/lib/nonogram/lines.test.ts`

**Interfaces:**
- Consumes: `Cell`, `Clue`.
- Produces: `lineSatisfied(marks, clue): boolean`; `lineFeasible(marks, clue): boolean`; `type LineState = "normal"|"satisfied"|"impossible"`; `lineState(marks, clue, won?): LineState`.

- [ ] **Step 1: Write the failing test** — `src/lib/nonogram/lines.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { lineSatisfied, lineFeasible, lineState } from "./lines";
import type { Cell } from "./types";

const C = (a: number[]) => a as Cell[];

describe("lineSatisfied", () => {
  it("matches exact runs", () => {
    expect(lineSatisfied(C([1, 1, 0, 1]), [2, 1])).toBe(true);
  });
  it("rejects wrong runs", () => {
    expect(lineSatisfied(C([1, 0, 1, 1]), [2, 1])).toBe(false);
  });
  it("treats marks(2) as empty", () => {
    expect(lineSatisfied(C([1, 2, 1, 1]), [1, 2])).toBe(true);
  });
  it("satisfies an empty clue with no fills", () => {
    expect(lineSatisfied(C([0, 2, 0]), [0])).toBe(true);
  });
});

describe("lineFeasible", () => {
  it("true when a clue can still be placed", () => {
    expect(lineFeasible(C([0, 0, 0, 0]), [2])).toBe(true);
  });
  it("false when a fill breaks the only placement", () => {
    // clue [3] in width 3 needs all filled; a known-empty(2) makes it impossible
    expect(lineFeasible(C([1, 2, 1]), [3])).toBe(false);
  });
  it("empty clue is infeasible once any cell is filled", () => {
    expect(lineFeasible(C([0, 1, 0]), [0])).toBe(false);
    expect(lineFeasible(C([0, 0, 0]), [0])).toBe(true);
  });
});

describe("lineState", () => {
  it("impossible takes precedence", () => {
    expect(lineState(C([1, 2, 1]), [3])).toBe("impossible");
  });
  it("satisfied when runs match", () => {
    expect(lineState(C([1, 1, 0]), [2])).toBe("satisfied");
  });
  it("won forces satisfied", () => {
    expect(lineState(C([0, 0, 0]), [1], true)).toBe("satisfied");
  });
  it("normal otherwise", () => {
    expect(lineState(C([0, 0, 0]), [1])).toBe("normal");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:run src/lib/nonogram/lines.test.ts`
Expected: FAIL — cannot find module `./lines`.

- [ ] **Step 3: Create `src/lib/nonogram/lines.ts`** (ported verbatim from the prototype)

```ts
import type { Cell, Clue } from "./types";

export function lineSatisfied(marks: ReadonlyArray<Cell>, clue: Clue): boolean {
  const runs: number[] = [];
  let r = 0;
  for (const v of marks) {
    if (v === 1) r++;
    else if (r) {
      runs.push(r);
      r = 0;
    }
  }
  if (r) runs.push(r);
  const rr = runs.length ? runs : [0];
  if (rr.length !== clue.length) return false;
  for (let i = 0; i < clue.length; i++) if (rr[i] !== clue[i]) return false;
  return true;
}

// Memoized DP: can `clue` still be satisfied given marks (1 filled, 2 known-empty, 0 unknown)?
// NOTE: key packs i*64+j — valid for line length < 64 (≤10 this slice). Revisit for big grids.
export function lineFeasible(marks: ReadonlyArray<Cell>, clue: Clue): boolean {
  const n = marks.length;
  if (clue.length === 1 && clue[0] === 0) return !marks.includes(1);
  const m = clue.length;
  const memo = new Map<number, boolean>();
  const go = (i: number, j: number): boolean => {
    if (j === m) {
      for (let k = i; k < n; k++) if (marks[k] === 1) return false;
      return true;
    }
    if (i >= n) return false;
    const key = i * 64 + j;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    let res = false;
    if (marks[i] !== 1) {
      if (go(i + 1, j)) res = true;
    }
    if (!res) {
      const len = clue[j];
      if (i + len <= n) {
        let ok = true;
        for (let k = i; k < i + len; k++)
          if (marks[k] === 2) {
            ok = false;
            break;
          }
        if (ok && i + len < n && marks[i + len] === 1) ok = false;
        if (ok) {
          const ni = i + len + (i + len < n ? 1 : 0);
          if (go(ni, j + 1)) res = true;
        }
      }
    }
    memo.set(key, res);
    return res;
  };
  return go(0, 0);
}

export type LineState = "normal" | "satisfied" | "impossible";

export function lineState(
  marks: ReadonlyArray<Cell>,
  clue: Clue,
  won = false,
): LineState {
  if (!lineFeasible(marks, clue)) return "impossible";
  if (won || lineSatisfied(marks, clue)) return "satisfied";
  return "normal";
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:run src/lib/nonogram/lines.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: nonogram line feasibility + satisfaction"
```

---

### Task 5: Win detection (`checkWin`)

**Files:**
- Create: `src/lib/nonogram/win.ts`
- Create: `src/lib/nonogram/win.test.ts`

**Interfaces:**
- Consumes: `Grid`, `Puzzle`, `cluesFor`, `column`, `lineSatisfied`.
- Produces: `checkWin(cells, puzzle): boolean`.

- [ ] **Step 1: Write the failing test** — `src/lib/nonogram/win.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { checkWin } from "./win";
import { solutionOf } from "./clues";
import type { Cell, Grid, Puzzle } from "./types";

const tee: Puzzle = { id: "t", name: "Tee", size: 3, rows: ["###", ".#.", ".#."] };

function solvedGrid(p: Puzzle): Grid {
  return solutionOf(p).map((row) => row.map((b) => (b ? 1 : 0) as Cell));
}

describe("checkWin", () => {
  it("true for the solved board", () => {
    expect(checkWin(solvedGrid(tee), tee)).toBe(true);
  });
  it("marks(2) count as empty, not filled", () => {
    const g = solvedGrid(tee);
    // turn the empties into explicit marks — still a win
    const marked: Grid = g.map((row) => row.map((v) => (v === 0 ? 2 : 1)) as Cell[]);
    expect(checkWin(marked, tee)).toBe(true);
  });
  it("false for an incomplete board", () => {
    const g = solvedGrid(tee);
    g[0][0] = 0;
    expect(checkWin(g, tee)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:run src/lib/nonogram/win.test.ts`
Expected: FAIL — cannot find module `./win`.

- [ ] **Step 3: Create `src/lib/nonogram/win.ts`**

```ts
import type { Grid, Puzzle } from "./types";
import { cluesFor } from "./clues";
import { column } from "./grid";
import { lineSatisfied } from "./lines";

// Constraint-based: win iff every row AND column clue is satisfied.
// Never compares against the solution grid.
export function checkWin(cells: Grid, puzzle: Puzzle): boolean {
  const { rowClues, colClues } = cluesFor(puzzle);
  const N = puzzle.size;
  for (let i = 0; i < N; i++) if (!lineSatisfied(cells[i], rowClues[i])) return false;
  for (let j = 0; j < N; j++)
    if (!lineSatisfied(column(cells, j), colClues[j])) return false;
  return true;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:run src/lib/nonogram/win.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: nonogram constraint-based win detection"
```

---

### Task 6: Solver — uniqueness (`countSolutions`) + line-solver (`lineSolve`, `difficultyOf`)

**Files:**
- Create: `src/lib/nonogram/solve.ts`
- Create: `src/lib/nonogram/solve.test.ts`

**Interfaces:**
- Consumes: `Clue`, `Cell`, `lineFeasible`.
- Produces:
  - `arrangements(clue, N): number[][]`
  - `countSolutions(rowClues, colClues, N, cap?): { status: "ok"; count: number } | { status: "unknown" }` — backtracking uniqueness count.
  - `interface LineSolveResult { solved: boolean; rounds: number }`
  - `lineSolve(rowClues, colClues, N): LineSolveResult` — pure constraint propagation (no guessing). `solved === true` means the grid is fully determined by line logic alone, which **implies a unique solution**.
  - `type Difficulty = "forager" | "woodlander" | "mycologist"`
  - `difficultyOf(rowClues, colClues, N): Difficulty` — grades via the line-solver; `mycologist` also covers "requires guessing" (line-solver stalls).

**Why both:** `lineSolve(...).solved` is the strong quality gate (no-guess ⟹ unique). `countSolutions` stays as an independent uniqueness cross-check and is what the later Studio slice needs to distinguish a *unique-but-guess-requiring* puzzle from a broken one.

- [ ] **Step 1: Write the failing test** — `src/lib/nonogram/solve.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { arrangements, countSolutions, lineSolve, difficultyOf } from "./solve";
import { cluesFor } from "./clues";
import type { Puzzle } from "./types";

describe("arrangements", () => {
  it("enumerates placements of a single block", () => {
    // clue [1] in width 3 → three positions
    expect(arrangements([1], 3)).toEqual([
      [1, 2, 2],
      [2, 1, 2],
      [2, 2, 1],
    ]);
  });
  it("a full line has exactly one arrangement", () => {
    expect(arrangements([3], 3)).toEqual([[1, 1, 1]]);
  });
  it("empty clue → all empty", () => {
    expect(arrangements([0], 3)).toEqual([[2, 2, 2]]);
  });
});

describe("countSolutions", () => {
  it("reports a unique solution", () => {
    const tee: Puzzle = { id: "t", name: "Tee", size: 3, rows: ["###", ".#.", ".#."] };
    const { rowClues, colClues } = cluesFor(tee);
    expect(countSolutions(rowClues, colClues, 3, 2)).toEqual({ status: "ok", count: 1 });
  });
  it("detects multiple solutions", () => {
    // a 2×2 checkerboard clue set has two solutions
    const rowClues = [[1], [1]];
    const colClues = [[1], [1]];
    const res = countSolutions(rowClues, colClues, 2, 2);
    expect(res).toEqual({ status: "ok", count: 2 });
  });
});

describe("lineSolve", () => {
  it("fully solves a line-solvable puzzle by logic alone", () => {
    const tee: Puzzle = { id: "t", name: "Tee", size: 3, rows: ["###", ".#.", ".#."] };
    const { rowClues, colClues } = cluesFor(tee);
    expect(lineSolve(rowClues, colClues, 3).solved).toBe(true);
  });
  it("reports unsolved when a clue set requires guessing", () => {
    // 2×2 with [1]/[1] rows & cols: two solutions, line logic forces nothing
    expect(lineSolve([[1], [1]], [[1], [1]], 2).solved).toBe(false);
  });
});

describe("difficultyOf", () => {
  it("grades a simple line-solvable puzzle below mycologist", () => {
    const tee: Puzzle = { id: "t", name: "Tee", size: 3, rows: ["###", ".#.", ".#."] };
    const { rowClues, colClues } = cluesFor(tee);
    expect(["forager", "woodlander"]).toContain(difficultyOf(rowClues, colClues, 3));
  });
  it("labels a guess-requiring set as mycologist", () => {
    expect(difficultyOf([[1], [1]], [[1], [1]], 2)).toBe("mycologist");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:run src/lib/nonogram/solve.test.ts`
Expected: FAIL — cannot find module `./solve`.

- [ ] **Step 3: Create `src/lib/nonogram/solve.ts`** (ported from the prototype editor)

```ts
import type { Cell, Clue } from "./types";
import { lineFeasible } from "./lines";

// Every placement of a line, as an array of 1 (filled) / 2 (empty), length N.
export function arrangements(clue: Clue, N: number): number[][] {
  if (clue.length === 1 && clue[0] === 0) return [new Array(N).fill(2)];
  const blocks = clue;
  const k = blocks.length;
  const out: number[][] = [];
  const suffix = (idx: number) => {
    let s = 0;
    for (let i = idx; i < k; i++) s += blocks[i];
    return s + (k - 1 - idx);
  };
  const place = (idx: number, pos: number, arr: number[]) => {
    if (idx === k) {
      const a = arr.slice();
      for (let i = pos; i < N; i++) a[i] = 2;
      out.push(a);
      return;
    }
    const maxStart = N - suffix(idx);
    for (let start = pos; start <= maxStart; start++) {
      const a = arr.slice();
      for (let i = pos; i < start; i++) a[i] = 2;
      for (let i = start; i < start + blocks[idx]; i++) a[i] = 1;
      let next = start + blocks[idx];
      if (next < N) {
        a[next] = 2;
        next++;
      }
      place(idx + 1, next, a);
    }
  };
  place(0, 0, new Array(N).fill(0));
  return out;
}

export type CountResult =
  | { status: "ok"; count: number }
  | { status: "unknown" };

// DFS placing one row-arrangement at a time, pruning per-column with lineFeasible.
// Counts up to `cap` full solutions; a node budget caps runaway cases → "unknown".
export function countSolutions(
  rowClues: Clue[],
  colClues: Clue[],
  N: number,
  cap = 2,
): CountResult {
  const rowOpts = rowClues.map((cl) => arrangements(cl, N));
  for (const o of rowOpts) if (o.length === 0) return { status: "ok", count: 0 };
  const grid: number[][] = [];
  let count = 0;
  let nodes = 0;
  let aborted = false;
  const BUDGET = 400000;
  const colOK = (upto: number): boolean => {
    for (let c = 0; c < N; c++) {
      const marks: Cell[] = new Array(N).fill(0);
      for (let r = 0; r <= upto; r++) marks[r] = grid[r][c] as Cell;
      if (!lineFeasible(marks, colClues[c])) return false;
    }
    return true;
  };
  const dfs = (r: number) => {
    if (aborted || count >= cap) return;
    if (r === N) {
      count++;
      return;
    }
    for (const opt of rowOpts[r]) {
      if (nodes++ > BUDGET) {
        aborted = true;
        return;
      }
      grid[r] = opt;
      if (colOK(r)) dfs(r + 1);
      if (aborted || count >= cap) {
        grid.length = r;
        return;
      }
    }
    grid.length = r;
  };
  dfs(0);
  return aborted ? { status: "unknown" } : { status: "ok", count };
}

// ---- Line-solver (pure constraint propagation, no guessing) ----
// Internal grid representation: 0 unknown · 1 filled · 2 empty (matches `arrangements`).

function consistent(a: number[], marks: number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (marks[i] === 1 && a[i] !== 1) return false;
    if (marks[i] === 2 && a[i] !== 2) return false;
  }
  return true;
}

// For one line, fill every cell that ALL consistent arrangements agree on.
function lineForced(marks: number[], clue: Clue, N: number): number[] {
  const opts = arrangements(clue, N);
  if (opts.length > 60000) return marks; // too many to enumerate cheaply
  const cons = opts.filter((a) => consistent(a, marks));
  if (cons.length === 0) return marks; // contradiction; leave as-is
  const res = marks.slice();
  for (let i = 0; i < N; i++) {
    if (res[i] === 0) {
      const v = cons[0][i];
      let all = true;
      for (let k = 1; k < cons.length; k++)
        if (cons[k][i] !== v) {
          all = false;
          break;
        }
      if (all) res[i] = v;
    }
  }
  return res;
}

export interface LineSolveResult {
  solved: boolean; // grid fully determined by line logic alone (⟹ unique)
  rounds: number; // propagation rounds to fixpoint
}

export function lineSolve(rowClues: Clue[], colClues: Clue[], N: number): LineSolveResult {
  const known: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
  let rounds = 0;
  let changed = true;
  while (changed && rounds < 80) {
    changed = false;
    rounds++;
    for (let r = 0; r < N; r++) {
      const nm = lineForced(known[r], rowClues[r], N);
      for (let c = 0; c < N; c++)
        if (nm[c] !== known[r][c]) {
          known[r][c] = nm[c];
          changed = true;
        }
    }
    for (let c = 0; c < N; c++) {
      const cm = known.map((row) => row[c]);
      const nm = lineForced(cm, colClues[c], N);
      for (let r = 0; r < N; r++)
        if (nm[r] !== known[r][c]) {
          known[r][c] = nm[r];
          changed = true;
        }
    }
  }
  let solved = true;
  for (let r = 0; r < N && solved; r++)
    for (let c = 0; c < N; c++)
      if (known[r][c] === 0) {
        solved = false;
        break;
      }
  return { solved, rounds };
}

export type Difficulty = "forager" | "woodlander" | "mycologist";

export function difficultyOf(rowClues: Clue[], colClues: Clue[], N: number): Difficulty {
  const { solved, rounds } = lineSolve(rowClues, colClues, N);
  if (!solved) return "mycologist"; // requires guessing
  if (rounds <= 2) return "forager";
  if (rounds <= 5) return "woodlander";
  return "mycologist";
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:run src/lib/nonogram/solve.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: nonogram uniqueness solver + line-solver/difficulty"
```

---

### Task 7: Built-in puzzles + barrel export + uniqueness guard

**Files:**
- Create: `src/lib/nonogram/index.ts`
- Create: `src/lib/puzzles/builtins.ts`
- Create: `src/lib/puzzles/builtins.test.ts`

**Interfaces:**
- Consumes: everything in `src/lib/nonogram/`.
- Produces: barrel `src/lib/nonogram/index.ts` re-exporting all public symbols; `BUILTINS: Puzzle[]`.

- [ ] **Step 1: Create the barrel** — `src/lib/nonogram/index.ts`

```ts
export * from "./types";
export * from "./grid";
export * from "./clues";
export * from "./lines";
export * from "./win";
export * from "./solve";
```

- [ ] **Step 2: Write the failing test** — `src/lib/puzzles/builtins.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { BUILTINS } from "./builtins";
import { cluesFor, countSolutions, lineSolve, difficultyOf } from "@/lib/nonogram";

describe("BUILTINS", () => {
  it("has at least 4 puzzles", () => {
    expect(BUILTINS.length).toBeGreaterThanOrEqual(4);
  });

  it("every puzzle is square and well-formed", () => {
    for (const p of BUILTINS) {
      expect(p.rows.length).toBe(p.size);
      for (const row of p.rows) {
        expect(row.length).toBe(p.size);
        expect(/^[#.]+$/.test(row)).toBe(true);
      }
    }
  });

  // PRIMARY GATE: solvable by pure line logic, no guessing (this also implies a unique solution).
  it("every puzzle is line-solvable without guessing", () => {
    for (const p of BUILTINS) {
      const { rowClues, colClues } = cluesFor(p);
      expect(
        lineSolve(rowClues, colClues, p.size).solved,
        `"${p.name}" must be solvable by logic alone (no guessing)`,
      ).toBe(true);
    }
  });

  // CROSS-CHECK: independent backtracking count agrees there is exactly one solution.
  it("every puzzle has exactly one solution", () => {
    for (const p of BUILTINS) {
      const { rowClues, colClues } = cluesFor(p);
      expect(
        countSolutions(rowClues, colClues, p.size, 2),
        `"${p.name}" should be uniquely solvable`,
      ).toEqual({ status: "ok", count: 1 });
    }
  });

  // Difficulty grades to a real tier (never undefined); built-ins should not be mycologist.
  it("every puzzle grades to forager or woodlander", () => {
    for (const p of BUILTINS) {
      const { rowClues, colClues } = cluesFor(p);
      expect(
        ["forager", "woodlander"],
        `"${p.name}" graded too hard for a built-in`,
      ).toContain(difficultyOf(rowClues, colClues, p.size));
    }
  });

  it("has unique ids", () => {
    const ids = BUILTINS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm test:run src/lib/puzzles/builtins.test.ts`
Expected: FAIL — cannot find module `./builtins`.

- [ ] **Step 4: Create `src/lib/puzzles/builtins.ts`**

Start from the prototype defaults plus two 5×5 starters. **The line-solvability test is the gate** (it implies uniqueness): when you run the tests (next step), any puzzle that isn't solvable by pure logic — `lineSolve(...).solved === false`, or graded `mycologist` (needs guessing), or with more than one solution — must be edited (add/remove `#`s, keeping the picture recognizable) until every assertion passes. The prototype's 10×10 defaults were never verified, so expect to adjust them.

```ts
import type { Puzzle } from "@/lib/nonogram";

export const BUILTINS: Puzzle[] = [
  {
    id: "sprout",
    name: "Sprout",
    size: 5,
    rows: ["..#..", "..#..", "#.#.#", ".###.", "..#.."],
  },
  {
    id: "diamond",
    name: "Diamond",
    size: 5,
    rows: ["..#..", ".###.", "#####", ".###.", "..#.."],
  },
  {
    id: "toadstool",
    name: "Toadstool",
    size: 10,
    rows: [
      "...####...",
      ".########.",
      "##########",
      "##########",
      ".########.",
      "...####...",
      "....##....",
      "....##....",
      "...####...",
      "..######..",
    ],
  },
  {
    id: "heart",
    name: "Heart",
    size: 10,
    rows: [
      ".##....##.",
      "##########",
      "##########",
      "##########",
      ".########.",
      "..######..",
      "...####...",
      "....##....",
      "..........",
      "..........",
    ],
  },
  {
    id: "cottage",
    name: "Cottage",
    size: 10,
    rows: [
      "....#.....",
      "...###....",
      "..#####...",
      ".#######..",
      "#########.",
      ".#######..",
      ".#.....#..",
      ".#.###.#..",
      ".#.###.#..",
      ".#.###.#..",
    ],
  },
];
```

- [ ] **Step 5: Run the gate and fix any puzzle that needs guessing or isn't unique**

Run: `pnpm test:run src/lib/puzzles/builtins.test.ts`
Expected: ideally PASS. If the "line-solvable", "exactly one solution", or "forager or woodlander" test fails for a puzzle, edit that puzzle's `rows` (add/remove filled cells while keeping the picture recognizable) and re-run until all assertions PASS. Do not weaken the tests.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: built-in puzzles with uniqueness guard + lib barrel"
```

---

### Task 8: Game state hook (`usePuzzleGame`) + time formatting

**Files:**
- Create: `src/features/play/format.ts`
- Create: `src/features/play/format.test.ts`
- Create: `src/features/play/usePuzzleGame.ts`
- Create: `src/features/play/reducer.ts`
- Create: `src/features/play/reducer.test.ts`

**Interfaces:**
- Consumes: `Cell`, `Grid`, `Puzzle`, `Clue`, `emptyGrid`, `checkWin`, `cluesFor`, `column`, `lineState`, `LineState`.
- Produces:
  - `formatTime(ms: number): string`
  - `type Mode = "fill" | "mark"`
  - `interface PlayState { index; puzzle; cells; mode; startTs; won; frozenElapsed }`
  - `type PlayAction` (see below) and pure `reducer(state, action)`; `initState(puzzles): PlayState`
  - `usePuzzleGame(puzzles): PlayApi` (see below)

- [ ] **Step 1: Write the failing format test** — `src/features/play/format.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { formatTime } from "./format";

describe("formatTime", () => {
  it("formats m:ss", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(65000)).toBe("1:05");
  });
  it("clamps negatives", () => {
    expect(formatTime(-5)).toBe("0:00");
  });
});
```

- [ ] **Step 2: Create `src/features/play/format.ts`**

```ts
export function formatTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
```

- [ ] **Step 3: Run format test**

Run: `pnpm test:run src/features/play/format.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 4: Write the failing reducer test** — `src/features/play/reducer.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { reducer, initState } from "./reducer";
import type { Puzzle } from "@/lib/nonogram";

const tee: Puzzle = { id: "t", name: "Tee", size: 3, rows: ["###", ".#.", ".#."] };
const other: Puzzle = { id: "o", name: "Oh", size: 3, rows: ["###", "#.#", "###"] };
const puzzles = [tee, other];

describe("reducer", () => {
  it("apply sets a cell and starts the clock", () => {
    const s0 = initState(puzzles);
    const s1 = reducer(s0, { type: "apply", r: 0, c: 0, value: 1, ts: 1000 });
    expect(s1.cells[0][0]).toBe(1);
    expect(s1.startTs).toBe(1000);
    expect(s1.won).toBe(false);
  });

  it("apply is a no-op when value is unchanged", () => {
    const s0 = initState(puzzles);
    const s1 = reducer(s0, { type: "apply", r: 0, c: 0, value: 0, ts: 1000 });
    expect(s1).toBe(s0);
  });

  it("detects a win and freezes elapsed", () => {
    let s = initState(puzzles);
    // solve the Tee: row0 all filled, row1 col1, row2 col1
    const fills: [number, number][] = [[0, 0], [0, 1], [0, 2], [1, 1], [2, 1]];
    let ts = 1000;
    for (const [r, c] of fills) s = reducer(s, { type: "apply", r, c, value: 1, ts: (ts += 1000) });
    expect(s.won).toBe(true);
    expect(s.frozenElapsed).toBe(s.startTs === null ? 0 : ts - s.startTs);
  });

  it("ignores input after win", () => {
    let s = initState(puzzles);
    const fills: [number, number][] = [[0, 0], [0, 1], [0, 2], [1, 1], [2, 1]];
    let ts = 1000;
    for (const [r, c] of fills) s = reducer(s, { type: "apply", r, c, value: 1, ts: (ts += 1000) });
    const after = reducer(s, { type: "apply", r: 1, c: 0, value: 1, ts: 99999 });
    expect(after).toBe(s);
  });

  it("reset clears the board, keeps the puzzle", () => {
    let s = initState(puzzles);
    s = reducer(s, { type: "apply", r: 0, c: 0, value: 1, ts: 1000 });
    s = reducer(s, { type: "reset" });
    expect(s.cells[0][0]).toBe(0);
    expect(s.startTs).toBeNull();
    expect(s.puzzle.id).toBe("t");
  });

  it("load swaps puzzle and resets board", () => {
    let s = initState(puzzles);
    s = reducer(s, { type: "load", index: 1, puzzle: other });
    expect(s.puzzle.id).toBe("o");
    expect(s.cells).toEqual([[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
  });
});
```

- [ ] **Step 5: Run to verify it fails**

Run: `pnpm test:run src/features/play/reducer.test.ts`
Expected: FAIL — cannot find module `./reducer`.

- [ ] **Step 6: Create `src/features/play/reducer.ts`**

```ts
import type { Cell, Grid, Puzzle } from "@/lib/nonogram";
import { emptyGrid, checkWin } from "@/lib/nonogram";

export type Mode = "fill" | "mark";

export interface PlayState {
  index: number;
  puzzle: Puzzle;
  cells: Grid;
  mode: Mode;
  startTs: number | null;
  won: boolean;
  frozenElapsed: number;
}

export type PlayAction =
  | { type: "apply"; r: number; c: number; value: Cell; ts: number }
  | { type: "setMode"; mode: Mode }
  | { type: "reset" }
  | { type: "load"; index: number; puzzle: Puzzle };

export function initState(puzzles: Puzzle[]): PlayState {
  const puzzle = puzzles[0];
  return {
    index: 0,
    puzzle,
    cells: emptyGrid(puzzle.size),
    mode: "fill",
    startTs: null,
    won: false,
    frozenElapsed: 0,
  };
}

export function reducer(state: PlayState, action: PlayAction): PlayState {
  switch (action.type) {
    case "apply": {
      if (state.won) return state;
      const { r, c, value, ts } = action;
      if (state.cells[r][c] === value) return state;
      const cells = state.cells.map((row) => row.slice()) as Grid;
      cells[r][c] = value;
      const startTs = state.startTs ?? ts;
      const won = checkWin(cells, state.puzzle);
      return {
        ...state,
        cells,
        startTs,
        won,
        frozenElapsed: won ? ts - startTs : state.frozenElapsed,
      };
    }
    case "setMode":
      return { ...state, mode: action.mode };
    case "reset":
      return {
        ...state,
        cells: emptyGrid(state.puzzle.size),
        startTs: null,
        won: false,
        frozenElapsed: 0,
      };
    case "load":
      return {
        index: action.index,
        puzzle: action.puzzle,
        cells: emptyGrid(action.puzzle.size),
        mode: state.mode,
        startTs: null,
        won: false,
        frozenElapsed: 0,
      };
  }
}
```

- [ ] **Step 7: Run reducer test**

Run: `pnpm test:run src/features/play/reducer.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 8: Create the hook** — `src/features/play/usePuzzleGame.ts`

```ts
"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import type { Cell, Clue, Puzzle } from "@/lib/nonogram";
import { cluesFor, column, lineState, type LineState } from "@/lib/nonogram";
import { reducer, initState, type Mode } from "./reducer";

export interface PlayApi {
  puzzle: Puzzle;
  cells: Cell[][];
  mode: Mode;
  won: boolean;
  elapsedMs: number;
  rowClues: Clue[];
  colClues: Clue[];
  rowState: LineState[];
  colState: LineState[];
  hasConflict: boolean;
  paint(r: number, c: number, value: Cell): void;
  primaryValueAt(r: number, c: number): Cell; // what a fill/mark-mode press would set
  markValueAt(r: number, c: number): Cell; // what a mark toggle would set
  setMode(m: Mode): void;
  reset(): void;
  next(): void;
}

export function usePuzzleGame(puzzles: Puzzle[]): PlayApi {
  const [state, dispatch] = useReducer(reducer, puzzles, initState);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!state.startTs || state.won) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [state.startTs, state.won]);

  const { rowClues, colClues } = useMemo(() => cluesFor(state.puzzle), [state.puzzle]);

  const rowState = useMemo(
    () => state.cells.map((row, i) => lineState(row, rowClues[i], state.won)),
    [state.cells, rowClues, state.won],
  );
  const colState = useMemo(
    () => colClues.map((cl, c) => lineState(column(state.cells, c), cl, state.won)),
    [state.cells, colClues, state.won],
  );

  const hasConflict =
    !state.won && (rowState.includes("impossible") || colState.includes("impossible"));

  const elapsedMs = state.won
    ? state.frozenElapsed
    : state.startTs
      ? Math.max(0, now - state.startTs)
      : 0;

  return {
    puzzle: state.puzzle,
    cells: state.cells,
    mode: state.mode,
    won: state.won,
    elapsedMs,
    rowClues,
    colClues,
    rowState,
    colState,
    hasConflict,
    paint: (r, c, value) => dispatch({ type: "apply", r, c, value, ts: Date.now() }),
    primaryValueAt: (r, c) => {
      const cur = state.cells[r][c];
      if (state.mode === "fill") return cur === 1 ? 0 : 1;
      return cur === 2 ? 0 : 2;
    },
    markValueAt: (r, c) => (state.cells[r][c] === 2 ? 0 : 2),
    setMode: (mode) => dispatch({ type: "setMode", mode }),
    reset: () => dispatch({ type: "reset" }),
    next: () =>
      dispatch({
        type: "load",
        index: (state.index + 1) % puzzles.length,
        puzzle: puzzles[(state.index + 1) % puzzles.length],
      }),
  };
}
```

- [ ] **Step 9: Run the whole suite + typecheck**

Run: `pnpm test:run && pnpm typecheck`
Expected: all PASS; tsc clean.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: usePuzzleGame state hook + reducer + time formatting"
```

---

### Task 9: `Cell` component

**Files:**
- Create: `src/features/play/Cell.tsx`
- Create: `src/features/play/Cell.test.tsx`

**Interfaces:**
- Consumes: `Cell` type.
- Produces: `CellButton` React component with props below; helper `cellLabel(r, c, value): string`.

```ts
interface CellButtonProps {
  r: number;
  c: number;
  value: Cell;
  px: number;
  tabbable: boolean; // roving tabindex: exactly one cell true
  onPointerDown: (e: React.PointerEvent, r: number, c: number) => void;
  onPointerEnter: (r: number, c: number) => void;
  registerRef: (r: number, c: number, el: HTMLButtonElement | null) => void;
}
```

- [ ] **Step 1: Write the failing test** — `src/features/play/Cell.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CellButton, cellLabel } from "./Cell";

describe("cellLabel", () => {
  it("describes position and state (1-indexed)", () => {
    expect(cellLabel(0, 0, 0)).toBe("Row 1, column 1, empty");
    expect(cellLabel(1, 2, 1)).toBe("Row 2, column 3, filled");
    expect(cellLabel(2, 0, 2)).toBe("Row 3, column 1, marked");
  });
});

describe("CellButton", () => {
  const noop = () => {};
  it("renders a gridcell button with an aria-label and × when marked", () => {
    render(
      <CellButton
        r={0}
        c={0}
        value={2}
        px={34}
        tabbable
        onPointerDown={noop}
        onPointerEnter={noop}
        registerRef={noop}
      />,
    );
    const btn = screen.getByRole("gridcell");
    expect(btn).toHaveAttribute("aria-label", "Row 1, column 1, marked");
    expect(btn).toHaveTextContent("×");
    expect(btn).toHaveAttribute("tabindex", "0");
  });

  it("is not tabbable when tabbable=false", () => {
    render(
      <CellButton
        r={0}
        c={1}
        value={0}
        px={34}
        tabbable={false}
        onPointerDown={noop}
        onPointerEnter={noop}
        registerRef={noop}
      />,
    );
    expect(screen.getByRole("gridcell")).toHaveAttribute("tabindex", "-1");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:run src/features/play/Cell.test.tsx`
Expected: FAIL — cannot find module `./Cell`.

- [ ] **Step 3: Create `src/features/play/Cell.tsx`**

```tsx
"use client";

import { memo } from "react";
import type { Cell } from "@/lib/nonogram";

export function cellLabel(r: number, c: number, value: Cell): string {
  const state = value === 1 ? "filled" : value === 2 ? "marked" : "empty";
  return `Row ${r + 1}, column ${c + 1}, ${state}`;
}

const FILLED: React.CSSProperties = {
  background: "var(--shroom-accent)",
  boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.20)",
};
const REVEALED: React.CSSProperties = {
  background: "var(--tile-revealed)",
  boxShadow: "inset 0 0 0 1px var(--tile-revealed-edge)",
};

interface CellButtonProps {
  r: number;
  c: number;
  value: Cell;
  px: number;
  tabbable: boolean;
  onPointerDown: (e: React.PointerEvent, r: number, c: number) => void;
  onPointerEnter: (r: number, c: number) => void;
  registerRef: (r: number, c: number, el: HTMLButtonElement | null) => void;
}

export const CellButton = memo(function CellButton(props: CellButtonProps) {
  const { r, c, value, px, tabbable, onPointerDown, onPointerEnter, registerRef } = props;
  const skin = value === 1 ? FILLED : REVEALED;
  return (
    <button
      type="button"
      role="gridcell"
      aria-label={cellLabel(r, c, value)}
      tabIndex={tabbable ? 0 : -1}
      ref={(el) => registerRef(r, c, el)}
      onPointerDown={(e) => onPointerDown(e, r, c)}
      onPointerEnter={() => onPointerEnter(r, c)}
      onContextMenu={(e) => e.preventDefault()}
      className="rounded-[9px] flex items-center justify-center select-none font-mono font-semibold text-on-accent transition-transform duration-75 ease-out active:scale-[0.86]"
      style={{
        width: px,
        height: px,
        fontSize: Math.round(px * 0.5),
        color: value === 2 ? "var(--shroom-text-soft)" : "transparent",
        ...skin,
      }}
    >
      {value === 2 ? "×" : ""}
    </button>
  );
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:run src/features/play/Cell.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: accessible Cell button component"
```

---

### Task 10: `ClueLine` component

**Files:**
- Create: `src/features/play/ClueLine.tsx`
- Create: `src/features/play/ClueLine.test.tsx`

**Interfaces:**
- Consumes: `Clue`, `LineState`.
- Produces: `ClueLine` component:

```ts
interface ClueLineProps {
  items: Clue;
  state: LineState;
  orientation: "row" | "column";
  label: string; // e.g. "Row 2 clues: 3, 1" (for screen readers)
}
```

- [ ] **Step 1: Write the failing test** — `src/features/play/ClueLine.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ClueLine } from "./ClueLine";

describe("ClueLine", () => {
  it("renders numbers with an SR label", () => {
    render(<ClueLine items={[3, 1]} state="normal" orientation="row" label="Row 1 clues: 3, 1" />);
    const group = screen.getByLabelText("Row 1 clues: 3, 1");
    expect(group).toHaveTextContent("3");
    expect(group).toHaveTextContent("1");
  });

  it("shows a non-color cue when impossible", () => {
    render(<ClueLine items={[2]} state="impossible" orientation="row" label="Row 1 clues: 2" />);
    // data attribute carries the state for the non-color affordance + styling
    expect(screen.getByLabelText("Row 1 clues: 2")).toHaveAttribute("data-state", "impossible");
  });

  it("renders nothing visible for an empty [0] clue", () => {
    const { container } = render(
      <ClueLine items={[0]} state="normal" orientation="row" label="Row 1 clues: 0" />,
    );
    expect(container.querySelectorAll("span")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:run src/features/play/ClueLine.test.tsx`
Expected: FAIL — cannot find module `./ClueLine`.

- [ ] **Step 3: Create `src/features/play/ClueLine.tsx`**

```tsx
"use client";

import type { Clue } from "@/lib/nonogram";
import type { LineState } from "@/lib/nonogram";

interface ClueLineProps {
  items: Clue;
  state: LineState;
  orientation: "row" | "column";
  label: string;
}

const COLOR: Record<LineState, string> = {
  normal: "var(--text-strong, var(--shroom-text))",
  satisfied: "var(--shroom-text-soft)",
  impossible: "var(--mushroom-cap)",
};

export function ClueLine({ items, state, orientation, label }: ClueLineProps) {
  const isEmpty = items.length === 1 && items[0] === 0;
  return (
    <div
      aria-label={label}
      data-state={state}
      className={
        orientation === "row"
          ? "flex w-full items-center justify-end gap-[7px] pr-[9px]"
          : "flex h-full flex-col items-center justify-end gap-[2px]"
      }
    >
      {isEmpty
        ? null
        : items.map((n, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="font-mono text-[14px] font-semibold leading-none"
              style={{
                color: COLOR[state],
                opacity: state === "satisfied" ? 0.4 : 1,
                // non-color cue for the impossible state
                textDecoration: state === "impossible" ? "underline" : "none",
                textUnderlineOffset: "3px",
              }}
            >
              {n}
            </span>
          ))}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:run src/features/play/ClueLine.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: ClueLine with non-color impossible cue"
```

---

### Task 11: `Board` component (3 aligned grids, pointer drag, keyboard nav)

**Files:**
- Create: `src/features/play/Board.tsx`
- Create: `src/features/play/Board.test.tsx`

**Interfaces:**
- Consumes: `PlayApi` (subset), `CellButton`, `ClueLine`, `Cell`, `Clue`, `LineState`.
- Produces: `Board` component:

```ts
interface BoardProps {
  size: number;
  cells: Cell[][];
  rowClues: Clue[];
  colClues: Clue[];
  rowState: LineState[];
  colState: LineState[];
  primaryValueAt: (r: number, c: number) => Cell;
  markValueAt: (r: number, c: number) => Cell;
  paint: (r: number, c: number, value: Cell) => void;
}
```

Behavior:
- Cell size `px = size <= 5 ? 46 : 34`, gap `5`. Gutter width `max(62, maxRowClueLen*18 + 16)`, band height `max(62, maxColClueLen*19 + 12)`.
- Pointer: on `pointerdown`, latch a drag value (primary press → `primaryValueAt`; secondary/`button===2` → `markValueAt`), `paint` it; on `pointerenter` while dragging, `paint` the latched value; a window `pointerup` clears the drag.
- Keyboard (roving tabindex): one focused cell; Arrow keys move focus (clamped) and focus the target button; Space/Enter → `paint(r,c, primaryValueAt)`; `x`/`X` → `paint(r,c, markValueAt)`.

- [ ] **Step 1: Write the failing test** — `src/features/play/Board.test.tsx`

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Board } from "./Board";
import { cluesFor, emptyGrid, type Puzzle } from "@/lib/nonogram";

const tee: Puzzle = { id: "t", name: "Tee", size: 3, rows: ["###", ".#.", ".#."] };

function setup(onPaint = vi.fn()) {
  const { rowClues, colClues } = cluesFor(tee);
  render(
    <Board
      size={3}
      cells={emptyGrid(3)}
      rowClues={rowClues}
      colClues={colClues}
      rowState={["normal", "normal", "normal"]}
      colState={["normal", "normal", "normal"]}
      primaryValueAt={() => 1}
      markValueAt={() => 2}
      paint={onPaint}
    />,
  );
  return onPaint;
}

describe("Board", () => {
  it("exposes a 3×3 grid of gridcells", () => {
    setup();
    expect(screen.getByRole("grid")).toBeInTheDocument();
    expect(screen.getAllByRole("gridcell")).toHaveLength(9);
  });

  it("pointer down paints with the primary value", () => {
    const paint = setup();
    fireEvent.pointerDown(screen.getAllByRole("gridcell")[0], { button: 0 });
    expect(paint).toHaveBeenCalledWith(0, 0, 1);
  });

  it("space fills the focused cell", () => {
    const paint = setup();
    const first = screen.getAllByRole("gridcell")[0];
    first.focus();
    fireEvent.keyDown(first, { key: " " });
    expect(paint).toHaveBeenCalledWith(0, 0, 1);
  });

  it("x marks the focused cell", () => {
    const paint = setup();
    const first = screen.getAllByRole("gridcell")[0];
    first.focus();
    fireEvent.keyDown(first, { key: "x" });
    expect(paint).toHaveBeenCalledWith(0, 0, 2);
  });

  it("ArrowRight moves the roving tabindex", () => {
    setup();
    const cells = screen.getAllByRole("gridcell");
    cells[0].focus();
    fireEvent.keyDown(cells[0], { key: "ArrowRight" });
    expect(cells[1]).toHaveAttribute("tabindex", "0");
    expect(cells[0]).toHaveAttribute("tabindex", "-1");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:run src/features/play/Board.test.tsx`
Expected: FAIL — cannot find module `./Board`.

- [ ] **Step 3: Create `src/features/play/Board.tsx`**

```tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Cell, Clue, LineState } from "@/lib/nonogram";
import { CellButton } from "./Cell";
import { ClueLine } from "./ClueLine";

interface BoardProps {
  size: number;
  cells: Cell[][];
  rowClues: Clue[];
  colClues: Clue[];
  rowState: LineState[];
  colState: LineState[];
  primaryValueAt: (r: number, c: number) => Cell;
  markValueAt: (r: number, c: number) => Cell;
  paint: (r: number, c: number, value: Cell) => void;
}

const GAP = 5;

export function Board(props: BoardProps) {
  const {
    size,
    cells,
    rowClues,
    colClues,
    rowState,
    colState,
    primaryValueAt,
    markValueAt,
    paint,
  } = props;

  const px = size <= 5 ? 46 : 34;
  const maxRow = Math.max(1, ...rowClues.map((c) => c.length));
  const maxCol = Math.max(1, ...colClues.map((c) => c.length));
  const gutterW = Math.max(62, maxRow * 18 + 16);
  const bandH = Math.max(62, maxCol * 19 + 12);

  const dragValue = useRef<Cell | null>(null);
  const [focus, setFocus] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const refs = useRef<(HTMLButtonElement | null)[][]>([]);

  const registerRef = useCallback((r: number, c: number, el: HTMLButtonElement | null) => {
    if (!refs.current[r]) refs.current[r] = [];
    refs.current[r][c] = el;
  }, []);

  useEffect(() => {
    const up = () => (dragValue.current = null);
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent, r: number, c: number) => {
      e.preventDefault();
      const value = e.button === 2 ? markValueAt(r, c) : primaryValueAt(r, c);
      dragValue.current = value;
      paint(r, c, value);
    },
    [markValueAt, primaryValueAt, paint],
  );

  const onPointerEnter = useCallback(
    (r: number, c: number) => {
      if (dragValue.current != null) paint(r, c, dragValue.current);
    },
    [paint],
  );

  const moveFocus = useCallback(
    (r: number, c: number) => {
      const nr = Math.max(0, Math.min(size - 1, r));
      const nc = Math.max(0, Math.min(size - 1, c));
      setFocus({ r: nr, c: nc });
      refs.current[nr]?.[nc]?.focus();
    },
    [size],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent, r: number, c: number) => {
      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          moveFocus(r, c + 1);
          break;
        case "ArrowLeft":
          e.preventDefault();
          moveFocus(r, c - 1);
          break;
        case "ArrowUp":
          e.preventDefault();
          moveFocus(r - 1, c);
          break;
        case "ArrowDown":
          e.preventDefault();
          moveFocus(r + 1, c);
          break;
        case "Home":
          e.preventDefault();
          moveFocus(r, 0);
          break;
        case "End":
          e.preventDefault();
          moveFocus(r, size - 1);
          break;
        case " ":
        case "Enter":
          e.preventDefault();
          paint(r, c, primaryValueAt(r, c));
          break;
        case "x":
        case "X":
          e.preventDefault();
          paint(r, c, markValueAt(r, c));
          break;
      }
    },
    [moveFocus, paint, primaryValueAt, markValueAt, size],
  );

  const cluesLabel = (kind: "Row" | "Column", i: number, clue: Clue) =>
    `${kind} ${i + 1} clues: ${clue[0] === 0 && clue.length === 1 ? "none" : clue.join(", ")}`;

  return (
    <div className="flex flex-col items-start">
      {/* top clue band */}
      <div className="flex">
        <div style={{ width: gutterW, flex: "none" }} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${size}, ${px}px)`,
            gap: GAP,
            paddingLeft: 9,
            height: bandH,
            alignItems: "end",
          }}
        >
          {colClues.map((clue, c) => (
            <ClueLine
              key={c}
              items={clue}
              state={colState[c]}
              orientation="column"
              label={cluesLabel("Column", c, clue)}
            />
          ))}
        </div>
      </div>

      {/* left gutter + cell grid */}
      <div className="flex">
        <div
          style={{
            display: "grid",
            gridTemplateRows: `repeat(${size}, ${px}px)`,
            gap: GAP,
            width: gutterW,
            paddingTop: 9,
          }}
        >
          {rowClues.map((clue, r) => (
            <ClueLine
              key={r}
              items={clue}
              state={rowState[r]}
              orientation="row"
              label={cluesLabel("Row", r, clue)}
            />
          ))}
        </div>

        <div
          role="grid"
          aria-label={`Nonogram puzzle, ${size} by ${size}`}
          className="rounded-2xl bg-board"
          style={{ padding: 9 }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {cells.map((row, r) => (
            <div
              role="row"
              key={r}
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${size}, ${px}px)`,
                gap: GAP,
                marginBottom: r < size - 1 ? GAP : 0,
              }}
            >
              {row.map((value, c) => (
                <div key={c} onKeyDown={(e) => onKeyDown(e, r, c)}>
                  <CellButton
                    r={r}
                    c={c}
                    value={value}
                    px={px}
                    tabbable={focus.r === r && focus.c === c}
                    onPointerDown={onPointerDown}
                    onPointerEnter={onPointerEnter}
                    registerRef={registerRef}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:run src/features/play/Board.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: accessible Board with pointer drag + keyboard nav"
```

---

### Task 12: `PlayScreen` + wire route + integration test

**Files:**
- Create: `src/features/play/PlayScreen.tsx`
- Create: `src/features/play/PlayScreen.test.tsx`
- Modify: `src/app/page.tsx` (replace smoke test)

**Interfaces:**
- Consumes: `usePuzzleGame`, `Board`, `formatTime`, `ThemeToggle`, `BUILTINS`.
- Produces: `PlayScreen` default-exported-friendly named component rendered at `/`.

- [ ] **Step 1: Write the failing integration test** — `src/features/play/PlayScreen.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { PlayScreen } from "./PlayScreen";
import type { Puzzle } from "@/lib/nonogram";

const tee: Puzzle = { id: "t", name: "Tee", size: 3, rows: ["###", ".#.", ".#."] };

describe("PlayScreen", () => {
  it("renders header, mode toggle, and the board", () => {
    render(<PlayScreen puzzles={[tee]} />);
    expect(screen.getByText("3 × 3")).toBeInTheDocument();
    expect(screen.getByRole("grid")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fill" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark" })).toBeInTheDocument();
  });

  it("announces and shows the win card when solved", () => {
    render(<PlayScreen puzzles={[tee]} />);
    const cells = screen.getAllByRole("gridcell");
    // Tee solution: indices 0,1,2 (row0), 4 (row1 c1), 7 (row2 c1)
    for (const i of [0, 1, 2, 4, 7]) fireEvent.pointerDown(cells[i], { button: 0 });
    expect(screen.getByText("Picture complete!")).toBeInTheDocument();
    expect(screen.getByText(/it's a tee/i)).toBeInTheDocument();
    const status = screen.getByRole("status");
    expect(within(status).getByText(/picture complete/i)).toBeInTheDocument();
  });

  it("surfaces a conflict cue when a line becomes impossible", () => {
    render(<PlayScreen puzzles={[tee]} />);
    const cells = screen.getAllByRole("gridcell");
    // row 1 (index 3,4,5) clue is [1]; filling two cells in it makes it impossible
    fireEvent.pointerDown(cells[3], { button: 0 });
    fireEvent.pointerDown(cells[5], { button: 0 });
    expect(screen.getByRole("status")).toHaveTextContent(/can't be satisfied/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test:run src/features/play/PlayScreen.test.tsx`
Expected: FAIL — cannot find module `./PlayScreen`.

- [ ] **Step 3: Create `src/features/play/PlayScreen.tsx`**

```tsx
"use client";

import type { Puzzle } from "@/lib/nonogram";
import { ThemeToggle } from "@/components/ThemeToggle";
import { usePuzzleGame } from "./usePuzzleGame";
import { Board } from "./Board";
import { formatTime } from "./format";
import type { Mode } from "./reducer";

const MODES: { value: Mode; label: string }[] = [
  { value: "fill", label: "Fill" },
  { value: "mark", label: "Mark" },
];

export function PlayScreen({ puzzles }: { puzzles: Puzzle[] }) {
  const game = usePuzzleGame(puzzles);

  const liveMessage = game.won
    ? `Picture complete — it's a ${game.puzzle.name.toLowerCase()}, solved in ${formatTime(game.elapsedMs)}.`
    : game.hasConflict
      ? "A highlighted clue can't be satisfied yet — something above it needs to change."
      : "";

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-fit">
        {/* header */}
        <div className="mb-5 flex items-start justify-between gap-7">
          <div className="flex flex-col gap-[3px]">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[1.3px] text-ink-soft">
              Nonogram
            </span>
            <span className="text-[2.5rem] font-semibold leading-none text-ink">
              {game.puzzle.size} × {game.puzzle.size}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex min-w-[88px] items-center gap-2 rounded-pill bg-pill px-[15px] py-[9px]">
              <span className="font-mono text-xl font-semibold tabular-nums text-ink">
                {formatTime(game.elapsedMs)}
              </span>
            </div>
            <ThemeToggle />
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

        {/* footer */}
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
            <button
              type="button"
              onClick={game.reset}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-ink-soft hover:text-ink"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={game.next}
              className="rounded-xl bg-pill px-4 py-2 text-sm font-semibold text-ink hover:opacity-90"
            >
              New picture
            </button>
          </div>
        </div>

        {/* conflict hint (non-color: icon + text) */}
        {game.hasConflict && !game.won && (
          <div className="mt-[14px] flex items-center gap-2 text-sm font-medium" style={{ color: "var(--mushroom-cap)" }}>
            <span aria-hidden="true">▲</span>
            A highlighted clue can&apos;t be satisfied yet — something above it needs to change.
          </div>
        )}

        {/* win card */}
        {game.won && (
          <div className="mt-4 rounded-2xl bg-card p-5" style={{ animation: "ng-rise .35s ease-out" }}>
            <h2 className="text-2xl font-semibold text-ink">Picture complete!</h2>
            <p className="mt-1 text-sm text-ink-soft">
              It&apos;s a {game.puzzle.name.toLowerCase()} — solved in {formatTime(game.elapsedMs)}.
            </p>
            <div className="mt-4 flex gap-[10px]">
              <button
                type="button"
                onClick={game.next}
                className="rounded-xl bg-pill px-4 py-2 text-sm font-semibold text-ink hover:opacity-90"
              >
                New picture
              </button>
              <button
                type="button"
                onClick={game.reset}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:opacity-90"
              >
                Play again
              </button>
            </div>
          </div>
        )}

        {/* screen-reader announcements */}
        <div role="status" aria-live="polite" className="sr-only">
          {liveMessage}
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test:run src/features/play/PlayScreen.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Replace the smoke-test route** — overwrite `src/app/page.tsx`

```tsx
import { PlayScreen } from "@/features/play/PlayScreen";
import { BUILTINS } from "@/lib/puzzles/builtins";

export default function Home() {
  return <PlayScreen puzzles={BUILTINS} />;
}
```

- [ ] **Step 6: Add the `sr-only` utility + win animation to globals**

In `src/app/globals.css`, append:
```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@keyframes ng-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

- [ ] **Step 7: Full verification**

Run: `pnpm test:run && pnpm typecheck && pnpm lint`
Expected: all tests PASS, tsc clean, lint clean.

- [ ] **Step 8: Manual smoke check**

Run: `pnpm dev`, open http://localhost:3000. Verify: board renders, drag-fill paints a line, right-click marks, Fill/Mark toggle works, solving a puzzle shows the win card with the name + time, Light/Dark toggle recolors, keyboard (Tab to a cell, arrows, space, x) works.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: PlayScreen + wire core play to / route"
```

---

## Self-Review Notes (for the implementer)

- **Spec coverage:** pure logic module incl. uniqueness + line-solver/difficulty (Tasks 2–6), built-ins behind a line-solvable-no-guess gate with uniqueness cross-check (7), reducer/hook with constraint-based win + timer (8), accessible Cell/ClueLine/Board with keyboard + non-color cues + live region (9–12). All spec sections map to a task.
- **Out of scope (do NOT add):** Supabase, daily, library, archive, Studio, onboarding, persistence across reload, mobile pan/zoom, grids >10, color, 5-cell separators.
- **Known a11y limitation for this slice:** clue lines are labeled for screen readers and the cell grid is fully navigable, but clues are not wired as formal ARIA row/column *headers*. That richer association is a deliberate later refinement; the live region + labeled clue lines give a usable non-visual experience now.
- **If `pnpm lint` flags `vi` unused** in `Board.test.tsx`, remove the unused import.
