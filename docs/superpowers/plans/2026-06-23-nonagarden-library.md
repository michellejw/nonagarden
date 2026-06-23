# Nonagarden Library / Browse (Slice #4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a browsable Library of all published puzzles (minus future dailies) that players can play freely, with a completion "collection wall," auto-save/resume, and a shared app header.

**Architecture:** Two new pure localStorage modules (a completion ledger + an in-progress board map) sit beside the daily store. A pure `mapLibraryContent` filters future-scheduled dailies out of the published set; an ISR Server Component fetches content and hands it to client screens. The play surface is a new `LibraryPlayScreen` that reuses the existing `usePuzzleGame` + `Board` engine (Approach A), mirroring how `DailyScreen` wires persistence. The daily's win path gains one line so daily completions also populate the shared ledger.

**Tech Stack:** Next.js 16 (App Router, ISR), React 19, TypeScript, Tailwind v4, `@shroomgames/tokens`, Supabase JS, Vitest + Testing Library, pnpm.

## Global Constraints

- Package manager: **pnpm** only.
- Test runner: `pnpm test:run` (Vitest). Type check: `pnpm typecheck`. Lint: `pnpm lint`. Prod build: `pnpm build`. All four must be green before the slice merges.
- Test imports: `import { describe, it, expect, beforeEach } from "vitest"`; component tests use `@testing-library/react`. `window.localStorage.clear()` in `beforeEach` for store/component tests.
- All localStorage modules MUST be SSR-safe (`if (typeof window === "undefined")` guard), type-guarded on load (corrupt → defaults), and silent-fail on write (quota/privacy mode).
- Puzzle id is a uuid `string`; the completion ledger keys by puzzle **id** (same key the daily store uses as `puzzleId`).
- `Puzzle` = `{ id, name, size, rows: string[] }`, rows use `'#'` filled / `'.'` empty. `solutionOf(puzzle): boolean[][]`. `Difficulty = "forager" | "woodlander" | "mycologist"`.
- localStorage keys: ledger = `nonagarden.cleared.v1`, in-progress boards = `nonagarden.library.v1`. Daily store key `nonagarden.daily.v1` is untouched.
- Future-daily rule (verbatim semantics): a puzzle scheduled at `daily_schedule` position `P` is excluded from the Library iff `P > todayPosition`, where `todayPosition = daysSince(DAILY_EPOCH, todayLocal())`. Unscheduled puzzles are always included.
- Conventional commits (`feat:`, `test:`, `chore:`…). End each commit message body with the `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` trailer.
- Routes: `/library` (browse), `/library/[slug]` (play). Daily stays at `/`.

---

### Task 1: Completion ledger module

**Files:**
- Create: `src/lib/library/cleared.ts`
- Test: `src/lib/library/cleared.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface ClearedStore { version: 1; ids: string[] }`
  - `defaultCleared(): ClearedStore`
  - `loadCleared(): ClearedStore`
  - `recordCleared(id: string): ClearedStore` — adds id (deduped), persists, returns next store
  - `isCleared(store: ClearedStore, id: string): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/library/cleared.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  loadCleared,
  recordCleared,
  isCleared,
  defaultCleared,
  type ClearedStore,
} from "./cleared";

const KEY = "nonagarden.cleared.v1";

beforeEach(() => {
  window.localStorage.clear();
});

describe("completion ledger", () => {
  it("returns defaults when nothing is stored", () => {
    expect(loadCleared()).toEqual(defaultCleared());
    expect(loadCleared().ids).toEqual([]);
  });

  it("records a cleared id and persists it", () => {
    const next = recordCleared("abc");
    expect(next.ids).toEqual(["abc"]);
    expect(loadCleared().ids).toEqual(["abc"]);
  });

  it("dedupes repeated ids", () => {
    recordCleared("abc");
    const next = recordCleared("abc");
    expect(next.ids).toEqual(["abc"]);
  });

  it("isCleared reflects membership", () => {
    const store: ClearedStore = { version: 1, ids: ["x", "y"] };
    expect(isCleared(store, "y")).toBe(true);
    expect(isCleared(store, "z")).toBe(false);
  });

  it("falls back to defaults on corrupt data", () => {
    window.localStorage.setItem(KEY, "{ not json");
    expect(loadCleared()).toEqual(defaultCleared());
    window.localStorage.setItem(KEY, JSON.stringify({ version: 2, ids: ["a"] }));
    expect(loadCleared()).toEqual(defaultCleared());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/lib/library/cleared.test.ts`
Expected: FAIL — cannot find module `./cleared`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/library/cleared.ts
const KEY = "nonagarden.cleared.v1";

export interface ClearedStore {
  version: 1;
  ids: string[];
}

export function defaultCleared(): ClearedStore {
  return { version: 1, ids: [] };
}

function isClearedStore(v: unknown): v is ClearedStore {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    s.version === 1 &&
    Array.isArray(s.ids) &&
    s.ids.every((x) => typeof x === "string")
  );
}

export function loadCleared(): ClearedStore {
  if (typeof window === "undefined") return defaultCleared();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultCleared();
    const parsed: unknown = JSON.parse(raw);
    return isClearedStore(parsed) ? parsed : defaultCleared();
  } catch {
    return defaultCleared();
  }
}

function save(store: ClearedStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // quota / privacy-mode — fail silently.
  }
}

export function recordCleared(id: string): ClearedStore {
  const cur = loadCleared();
  if (cur.ids.includes(id)) return cur;
  const next: ClearedStore = { version: 1, ids: [...cur.ids, id] };
  save(next);
  return next;
}

export function isCleared(store: ClearedStore, id: string): boolean {
  return store.ids.includes(id);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/lib/library/cleared.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/library/cleared.ts src/lib/library/cleared.test.ts
git commit -m "feat: add Library completion ledger store"
```

---

### Task 2: In-progress board store

**Files:**
- Create: `src/lib/library/store.ts`
- Test: `src/lib/library/store.test.ts`

**Interfaces:**
- Consumes: `Cell` from `@/lib/nonogram`; `PuzzleGameSnapshot` shape (`{ cells, won, frozenElapsed }`) from `@/features/play/usePuzzleGame`.
- Produces:
  - `interface LibraryBoard { cells: Cell[][]; completed: boolean; elapsedMs: number }`
  - `interface LibraryStore { version: 1; boards: Record<string, LibraryBoard> }`
  - `defaultLibraryStore(): LibraryStore`
  - `loadLibraryStore(): LibraryStore`
  - `saveBoard(id: string, board: LibraryBoard): LibraryStore`
  - `dropBoard(id: string): LibraryStore`
  - `boardFor(store: LibraryStore, id: string): LibraryBoard | undefined`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/library/store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  loadLibraryStore,
  saveBoard,
  dropBoard,
  boardFor,
  defaultLibraryStore,
  type LibraryBoard,
} from "./store";

const KEY = "nonagarden.library.v1";
const BOARD: LibraryBoard = { cells: [[1, 0], [0, 2]], completed: false, elapsedMs: 1200 };

beforeEach(() => {
  window.localStorage.clear();
});

describe("library in-progress store", () => {
  it("returns defaults when empty", () => {
    expect(loadLibraryStore()).toEqual(defaultLibraryStore());
  });

  it("saves and reads back a board by id", () => {
    saveBoard("p1", BOARD);
    expect(boardFor(loadLibraryStore(), "p1")).toEqual(BOARD);
    expect(boardFor(loadLibraryStore(), "missing")).toBeUndefined();
  });

  it("overwrites an existing board for the same id", () => {
    saveBoard("p1", BOARD);
    const updated: LibraryBoard = { ...BOARD, elapsedMs: 9999 };
    saveBoard("p1", updated);
    expect(boardFor(loadLibraryStore(), "p1")).toEqual(updated);
  });

  it("drops a board by id", () => {
    saveBoard("p1", BOARD);
    saveBoard("p2", BOARD);
    dropBoard("p1");
    const store = loadLibraryStore();
    expect(boardFor(store, "p1")).toBeUndefined();
    expect(boardFor(store, "p2")).toEqual(BOARD);
  });

  it("falls back to defaults on corrupt data", () => {
    window.localStorage.setItem(KEY, "nope");
    expect(loadLibraryStore()).toEqual(defaultLibraryStore());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/lib/library/store.test.ts`
Expected: FAIL — cannot find module `./store`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/library/store.ts
import type { Cell } from "@/lib/nonogram";

const KEY = "nonagarden.library.v1";

export interface LibraryBoard {
  cells: Cell[][];
  completed: boolean;
  elapsedMs: number;
}

export interface LibraryStore {
  version: 1;
  boards: Record<string, LibraryBoard>;
}

export function defaultLibraryStore(): LibraryStore {
  return { version: 1, boards: {} };
}

function isBoard(v: unknown): v is LibraryBoard {
  if (typeof v !== "object" || v === null) return false;
  const b = v as Record<string, unknown>;
  return (
    Array.isArray(b.cells) &&
    typeof b.completed === "boolean" &&
    typeof b.elapsedMs === "number"
  );
}

function isLibraryStore(v: unknown): v is LibraryStore {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  if (s.version !== 1 || typeof s.boards !== "object" || s.boards === null) return false;
  return Object.values(s.boards as Record<string, unknown>).every(isBoard);
}

export function loadLibraryStore(): LibraryStore {
  if (typeof window === "undefined") return defaultLibraryStore();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultLibraryStore();
    const parsed: unknown = JSON.parse(raw);
    return isLibraryStore(parsed) ? parsed : defaultLibraryStore();
  } catch {
    return defaultLibraryStore();
  }
}

function save(store: LibraryStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // quota / privacy-mode — fail silently.
  }
}

export function saveBoard(id: string, board: LibraryBoard): LibraryStore {
  const cur = loadLibraryStore();
  const next: LibraryStore = { version: 1, boards: { ...cur.boards, [id]: board } };
  save(next);
  return next;
}

export function dropBoard(id: string): LibraryStore {
  const cur = loadLibraryStore();
  if (!(id in cur.boards)) return cur;
  const boards = { ...cur.boards };
  delete boards[id];
  const next: LibraryStore = { version: 1, boards };
  save(next);
  return next;
}

export function boardFor(store: LibraryStore, id: string): LibraryBoard | undefined {
  return store.boards[id];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/lib/library/store.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/library/store.ts src/lib/library/store.test.ts
git commit -m "feat: add Library in-progress board store"
```

---

### Task 3: Library content fetch + future-daily mapping

**Files:**
- Modify: `src/lib/content/content.ts` (add `LibraryPuzzle`, `mapLibraryContent`, `fetchLibraryContent`)
- Test: `src/lib/content/library-content.test.ts`

**Interfaces:**
- Consumes: `Puzzle` from `@/lib/nonogram`; `Difficulty` from `@/lib/nonogram`; existing `ScheduleRow` from `content.ts`; `createReadClient` from `./client`; `SupabaseClient` type.
- Produces:
  - `interface LibraryPuzzleRow { id: string; name: string; size: number; rows: string[]; slug: string; difficulty: Difficulty }`
  - `interface LibraryPuzzle extends Puzzle { slug: string; difficulty: Difficulty }`
  - `mapLibraryContent(puzzleRows: LibraryPuzzleRow[], scheduleRows: ScheduleRow[], todayPosition: number): LibraryPuzzle[]` — published set minus puzzles whose schedule position `> todayPosition`; insertion order preserved.
  - `fetchLibraryContent(client?): Promise<LibraryPuzzle[] = raw rows>` — see note below; returns `{ puzzles: LibraryPuzzleRow[]; schedule: ScheduleRow[] }`.

Note: `fetchLibraryContent` returns the **raw rows + schedule** (NOT yet filtered), because `todayPosition` is timezone-local and resolved on the client. The client calls `mapLibraryContent` after mount. This mirrors `fetchDailyContent` returning the full set + schedule.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/content/library-content.test.ts
import { describe, it, expect } from "vitest";
import {
  mapLibraryContent,
  fetchLibraryContent,
  type LibraryPuzzleRow,
} from "./content";

const rows = (slug: string, id = slug): LibraryPuzzleRow => ({
  id,
  slug,
  name: slug,
  size: 5,
  rows: ["#####", "#####", "#####", "#####", "#####"],
  difficulty: "forager",
});

describe("mapLibraryContent", () => {
  it("includes unscheduled puzzles always", () => {
    const out = mapLibraryContent([rows("a"), rows("b")], [], 0);
    expect(out.map((p) => p.slug)).toEqual(["a", "b"]);
  });

  it("includes a puzzle scheduled at exactly today (position == todayPosition)", () => {
    const out = mapLibraryContent(
      [rows("a", "id-a")],
      [{ position: 3, puzzle_id: "id-a" }],
      3,
    );
    expect(out.map((p) => p.slug)).toEqual(["a"]);
  });

  it("excludes a puzzle scheduled in the future (position > todayPosition)", () => {
    const out = mapLibraryContent(
      [rows("a", "id-a"), rows("b", "id-b")],
      [
        { position: 2, puzzle_id: "id-a" },
        { position: 4, puzzle_id: "id-b" },
      ],
      3,
    );
    expect(out.map((p) => p.slug)).toEqual(["a"]); // b is future
  });

  it("excludes everything scheduled when before epoch (todayPosition negative)", () => {
    const out = mapLibraryContent(
      [rows("a", "id-a"), rows("u")],
      [{ position: 0, puzzle_id: "id-a" }],
      -1,
    );
    expect(out.map((p) => p.slug)).toEqual(["u"]); // only the unscheduled one
  });
});

describe("fetchLibraryContent", () => {
  it("returns published rows + schedule from the client", async () => {
    const fake = {
      from(table: string) {
        return {
          select() {
            return {
              eq() {
                return Promise.resolve({
                  data: [rows("a")],
                  error: null,
                });
              },
            };
          },
        } as never;
      },
    };
    // schedule table has no .eq — handle both shapes:
    const client = {
      from(table: string) {
        if (table === "puzzles") {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: [rows("a")], error: null }),
            }),
          } as never;
        }
        return {
          select: () =>
            Promise.resolve({ data: [{ position: 0, puzzle_id: "a" }], error: null }),
        } as never;
      },
    };
    const out = await fetchLibraryContent(client as never);
    expect(out.puzzles.map((p) => p.slug)).toEqual(["a"]);
    expect(out.schedule).toEqual([{ position: 0, puzzle_id: "a" }]);
  });

  it("throws when the puzzles query errors", async () => {
    const client = {
      from() {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: null, error: new Error("boom") }),
          }),
          // schedule branch:
          then: undefined,
        } as never;
      },
    };
    await expect(fetchLibraryContent(client as never)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/lib/content/library-content.test.ts`
Expected: FAIL — `mapLibraryContent`/`fetchLibraryContent` not exported.

- [ ] **Step 3: Write minimal implementation** (append to `src/lib/content/content.ts`)

```ts
import type { Difficulty } from "@/lib/nonogram";

export interface LibraryPuzzleRow {
  id: string;
  name: string;
  size: number;
  rows: string[];
  slug: string;
  difficulty: Difficulty;
}

export interface LibraryPuzzle extends Puzzle {
  slug: string;
  difficulty: Difficulty;
}

export interface LibraryContent {
  puzzles: LibraryPuzzleRow[];
  schedule: ScheduleRow[];
}

/**
 * Published puzzles minus those scheduled as FUTURE dailies (schedule position
 * strictly greater than todayPosition). Unscheduled puzzles are always kept.
 * Pure: todayPosition is supplied by the caller (timezone-local, client-resolved).
 */
export function mapLibraryContent(
  puzzleRows: LibraryPuzzleRow[],
  scheduleRows: ScheduleRow[],
  todayPosition: number,
): LibraryPuzzle[] {
  const positionByPuzzle = new Map<string, number>();
  for (const s of scheduleRows) positionByPuzzle.set(s.puzzle_id, s.position);

  return puzzleRows
    .filter((r) => {
      const pos = positionByPuzzle.get(r.id);
      return pos === undefined || pos <= todayPosition;
    })
    .map((r) => ({
      id: r.id,
      name: r.name,
      size: r.size,
      rows: r.rows,
      slug: r.slug,
      difficulty: r.difficulty,
    }));
}

/**
 * Fetch published puzzles (incl. slug + difficulty) and the full schedule.
 * Returns RAW rows; the client applies mapLibraryContent once it knows the
 * player's local todayPosition. `client` is injectable for tests.
 */
export async function fetchLibraryContent(
  client: Pick<SupabaseClient, "from"> = createReadClient(),
): Promise<LibraryContent> {
  const [puzzleRes, scheduleRes] = await Promise.all([
    client
      .from("puzzles")
      .select("id,name,size,rows,slug,difficulty")
      .eq("status", "published"),
    client.from("daily_schedule").select("position,puzzle_id"),
  ]);
  if (puzzleRes.error) throw puzzleRes.error;
  if (scheduleRes.error) throw scheduleRes.error;
  return {
    puzzles: (puzzleRes.data ?? []) as LibraryPuzzleRow[],
    schedule: (scheduleRes.data ?? []) as ScheduleRow[],
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/lib/content/library-content.test.ts`
Expected: PASS (6 tests). If the second `fetchLibraryContent` error test is flaky on the fake-client shape, simplify the fake to a `from()` returning `{ select: () => ({ eq: () => Promise.resolve({ data: null, error: new Error("boom") }) }) }` for the puzzles branch and `{ select: () => Promise.resolve({ data: [], error: null }) }` for the schedule branch — match the two-branch fake used in the first test.

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/content.ts src/lib/content/library-content.test.ts
git commit -m "feat: add fetchLibraryContent + mapLibraryContent with future-daily exclusion"
```

---

### Task 4: DifficultyBadge component

**Files:**
- Create: `src/components/DifficultyBadge.tsx`
- Test: `src/components/DifficultyBadge.test.tsx`

**Interfaces:**
- Consumes: `Difficulty` from `@/lib/nonogram`.
- Produces: `DifficultyBadge({ difficulty }: { difficulty: Difficulty })` — a small pill with per-difficulty color + capitalized label.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/DifficultyBadge.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DifficultyBadge } from "./DifficultyBadge";

describe("DifficultyBadge", () => {
  it("shows the difficulty label", () => {
    render(<DifficultyBadge difficulty="woodlander" />);
    expect(screen.getByText(/woodlander/i)).toBeInTheDocument();
  });

  it("applies a distinct class per difficulty", () => {
    const { container: a } = render(<DifficultyBadge difficulty="forager" />);
    const { container: b } = render(<DifficultyBadge difficulty="mycologist" />);
    expect(a.firstChild).not.toBeNull();
    expect((a.firstChild as HTMLElement).className).not.toEqual(
      (b.firstChild as HTMLElement).className,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/components/DifficultyBadge.test.tsx`
Expected: FAIL — cannot find module `./DifficultyBadge`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/DifficultyBadge.tsx
import type { Difficulty } from "@/lib/nonogram";

// Cozy forest progression: forager (easy) → woodlander → mycologist (hard).
const STYLES: Record<Difficulty, string> = {
  forager: "bg-emerald-100 text-emerald-800",
  woodlander: "bg-amber-100 text-amber-800",
  mycologist: "bg-rose-100 text-rose-800",
};

const LABELS: Record<Difficulty, string> = {
  forager: "Forager",
  woodlander: "Woodlander",
  mycologist: "Mycologist",
};

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[0.6875rem] font-semibold ${STYLES[difficulty]}`}
    >
      {LABELS[difficulty]}
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/components/DifficultyBadge.test.tsx`
Expected: PASS (2 tests).

Note: if `bg-emerald-*`/`bg-amber-*`/`bg-rose-*` are not available in this Tailwind v4 + `@shroomgames/tokens` setup, substitute token-backed equivalents (check `src/app/globals.css` for available color utilities) while keeping three visually distinct styles. The test only requires distinct class strings + the label.

- [ ] **Step 5: Commit**

```bash
git add src/components/DifficultyBadge.tsx src/components/DifficultyBadge.test.tsx
git commit -m "feat: add per-difficulty DifficultyBadge component"
```

---

### Task 5: PuzzleTile component

**Files:**
- Create: `src/features/library/PuzzleTile.tsx`
- Test: `src/features/library/PuzzleTile.test.tsx`

**Interfaces:**
- Consumes: `LibraryPuzzle` from `@/lib/content/content`; `solutionOf` from `@/lib/nonogram`; `DifficultyBadge` from `@/components/DifficultyBadge`; Next `Link`.
- Produces: `PuzzleTile({ puzzle, cleared }: { puzzle: LibraryPuzzle; cleared: boolean })` — a link to `/library/[slug]`; when `cleared`, renders the revealed solution thumbnail; otherwise a neutral locked tile. Always shows name + size + difficulty badge.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/library/PuzzleTile.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PuzzleTile } from "./PuzzleTile";
import type { LibraryPuzzle } from "@/lib/content/content";

const PUZZLE: LibraryPuzzle = {
  id: "id-1",
  slug: "sprout",
  name: "Sprout",
  size: 5,
  rows: ["..#..", "..#..", "#.#.#", ".###.", "..#.."],
  difficulty: "forager",
};

describe("PuzzleTile", () => {
  it("links to the puzzle's play route", () => {
    render(<PuzzleTile puzzle={PUZZLE} cleared={false} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/library/sprout");
  });

  it("shows name, size, and difficulty", () => {
    render(<PuzzleTile puzzle={PUZZLE} cleared={false} />);
    expect(screen.getByText("Sprout")).toBeInTheDocument();
    expect(screen.getByText(/5\s*×\s*5/)).toBeInTheDocument();
    expect(screen.getByText(/forager/i)).toBeInTheDocument();
  });

  it("renders the revealed thumbnail only when cleared", () => {
    const { rerender } = render(<PuzzleTile puzzle={PUZZLE} cleared={false} />);
    expect(screen.queryByTestId("tile-thumbnail")).not.toBeInTheDocument();
    rerender(<PuzzleTile puzzle={PUZZLE} cleared={true} />);
    expect(screen.getByTestId("tile-thumbnail")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/features/library/PuzzleTile.test.tsx`
Expected: FAIL — cannot find module `./PuzzleTile`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/library/PuzzleTile.tsx
import Link from "next/link";
import { solutionOf } from "@/lib/nonogram";
import type { LibraryPuzzle } from "@/lib/content/content";
import { DifficultyBadge } from "@/components/DifficultyBadge";

function Thumbnail({ puzzle }: { puzzle: LibraryPuzzle }) {
  const sol = solutionOf(puzzle);
  return (
    <div
      data-testid="tile-thumbnail"
      className="grid aspect-square w-full overflow-hidden rounded-lg"
      style={{ gridTemplateColumns: `repeat(${puzzle.size}, 1fr)` }}
      aria-hidden
    >
      {sol.flatMap((row, r) =>
        row.map((filled, c) => (
          <span
            key={`${r}-${c}`}
            className={filled ? "bg-ink" : "bg-card"}
          />
        )),
      )}
    </div>
  );
}

export function PuzzleTile({
  puzzle,
  cleared,
}: {
  puzzle: LibraryPuzzle;
  cleared: boolean;
}) {
  return (
    <Link
      href={`/library/${puzzle.slug}`}
      className="flex flex-col gap-2 rounded-2xl bg-card p-3 transition-transform hover:-translate-y-0.5"
    >
      <div className="aspect-square w-full overflow-hidden rounded-lg bg-pill">
        {cleared ? (
          <Thumbnail puzzle={puzzle} />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl text-ink-soft" aria-hidden>
            🍄
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink">{puzzle.name}</span>
        <span className="text-xs text-ink-soft">
          {puzzle.size} × {puzzle.size}
        </span>
      </div>
      <DifficultyBadge difficulty={puzzle.difficulty} />
    </Link>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/features/library/PuzzleTile.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/library/PuzzleTile.tsx src/features/library/PuzzleTile.test.tsx
git commit -m "feat: add PuzzleTile with locked/revealed collection-wall states"
```

---

### Task 6: Shared AppHeader + layout wiring

**Files:**
- Create: `src/components/AppHeader.tsx`
- Test: `src/components/AppHeader.test.tsx`
- Modify: `src/app/layout.tsx` (render `<AppHeader />` above page content)
- Modify: `src/features/daily/DailyScreen.tsx` (remove inline `<ThemeToggle />` from its header)
- Modify: `src/features/play/PlayScreen.tsx` (remove inline `<ThemeToggle />` from its header)

**Interfaces:**
- Consumes: `ThemeToggle` from `@/components/ThemeToggle`; Next `Link`.
- Produces: `AppHeader()` — wordmark "Nonagarden" linking `/`, nav links `Daily` (`/`) + `Library` (`/library`), and the `ThemeToggle`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/AppHeader.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it("renders Daily and Library nav links", () => {
    render(<AppHeader />);
    expect(screen.getByRole("link", { name: /daily/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /library/i })).toHaveAttribute(
      "href",
      "/library",
    );
  });

  it("renders the wordmark", () => {
    render(<AppHeader />);
    expect(screen.getByText(/nonagarden/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/components/AppHeader.test.tsx`
Expected: FAIL — cannot find module `./AppHeader`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/AppHeader.tsx
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
```

Then wire it into the layout. In `src/app/layout.tsx`, import `AppHeader` and render it at the top of the `<body>` wrapper (above `{children}`), e.g.:

```tsx
import { AppHeader } from "@/components/AppHeader";
// ...inside the body wrapper that already wraps children:
<AppHeader />
{children}
```

(Match the existing body/provider structure — insert `<AppHeader />` as the first child of the flex column that contains `{children}`. Keep any existing theme provider wrapping.)

Then remove the now-duplicated `<ThemeToggle />` from `DailyScreen.tsx` (the `<div className="flex items-center gap-3">…<ThemeToggle /></div>` block — keep the streak pill, drop the toggle and collapse the wrapper if it becomes a single child) and from `PlayScreen.tsx` (its header `<ThemeToggle />`). Remove the now-unused `ThemeToggle` import from both files.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test:run src/components/AppHeader.test.tsx`
Expected: PASS (2 tests).
Run: `pnpm test:run src/features/daily/DailyScreen.test.tsx src/features/play/PlayScreen.test.tsx`
Expected: PASS — if a daily/play test asserted on the in-header theme toggle, update that assertion to reflect the toggle now living in `AppHeader` (those screen tests render the screen without the layout, so a removed toggle should not be asserted there).

- [ ] **Step 5: Run typecheck + commit**

Run: `pnpm typecheck`
Expected: no errors (confirms the removed `ThemeToggle` imports are clean).

```bash
git add src/components/AppHeader.tsx src/components/AppHeader.test.tsx src/app/layout.tsx src/features/daily/DailyScreen.tsx src/features/play/PlayScreen.tsx
git commit -m "feat: add shared AppHeader and move theme toggle into it"
```

---

### Task 7: LibraryScreen + /library route

**Files:**
- Create: `src/features/library/LibraryScreen.tsx`
- Test: `src/features/library/LibraryScreen.test.tsx`
- Create: `src/app/library/page.tsx`

**Interfaces:**
- Consumes: `LibraryPuzzleRow`, `ScheduleRow`, `mapLibraryContent` from `@/lib/content/content`; `loadCleared`, `isCleared` from `@/lib/library/cleared`; `daysSince` + `DAILY_EPOCH` (`DAILY_EPOCH` is exported from `@/lib/daily` via `list`); `todayLocal` from `@/features/daily/todayDate`; `PuzzleTile`.
- Produces: `LibraryScreen({ puzzles, schedule }: { puzzles: LibraryPuzzleRow[]; schedule: ScheduleRow[] })` — client component. After mount: resolves `todayPosition = daysSince(DAILY_EPOCH, todayLocal())`, filters via `mapLibraryContent`, groups by size ascending, renders a counter ("`X / N cleared`") + size-grouped `PuzzleTile` grids; empty set → friendly empty state.

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/library/LibraryScreen.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LibraryScreen } from "./LibraryScreen";
import { recordCleared } from "@/lib/library/cleared";
import type { LibraryPuzzleRow } from "@/lib/content/content";

const row = (slug: string, size: number, id = slug): LibraryPuzzleRow => ({
  id,
  slug,
  name: slug,
  size,
  rows: Array(size).fill("#".repeat(size)),
  difficulty: "forager",
});

beforeEach(() => {
  window.localStorage.clear();
});

describe("LibraryScreen", () => {
  it("renders a tile per included puzzle with a cleared counter", async () => {
    render(<LibraryScreen puzzles={[row("a", 5), row("b", 10)]} schedule={[]} />);
    // after client mount, tiles appear
    expect(await screen.findByText("a")).toBeInTheDocument();
    expect(screen.getByText("b")).toBeInTheDocument();
    expect(screen.getByText(/0\s*\/\s*2 cleared/i)).toBeInTheDocument();
  });

  it("reflects cleared count from the ledger", async () => {
    recordCleared("a");
    render(<LibraryScreen puzzles={[row("a", 5), row("b", 10)]} schedule={[]} />);
    expect(await screen.findByText(/1\s*\/\s*2 cleared/i)).toBeInTheDocument();
  });

  it("shows an empty state when nothing is browsable", async () => {
    render(<LibraryScreen puzzles={[]} schedule={[]} />);
    expect(await screen.findByText(/still growing/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/features/library/LibraryScreen.test.tsx`
Expected: FAIL — cannot find module `./LibraryScreen`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/library/LibraryScreen.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  mapLibraryContent,
  type LibraryPuzzleRow,
  type ScheduleRow,
  type LibraryPuzzle,
} from "@/lib/content/content";
import { loadCleared, isCleared, type ClearedStore } from "@/lib/library/cleared";
import { daysSince, DAILY_EPOCH } from "@/lib/daily";
import { todayLocal } from "@/features/daily/todayDate";
import { PuzzleTile } from "./PuzzleTile";

export function LibraryScreen({
  puzzles,
  schedule,
}: {
  puzzles: LibraryPuzzleRow[];
  schedule: ScheduleRow[];
}) {
  // Client-only: local date (timezone) + ledger (localStorage). Null until mounted
  // so SSR/first paint don't assume a position or read storage.
  const [ready, setReady] = useState(false);
  const [todayPosition, setTodayPosition] = useState(0);
  const [cleared, setCleared] = useState<ClearedStore>({ version: 1, ids: [] });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only bootstrap: resolve local date + ledger once after mount (SSR can't know timezone/localStorage).
    setTodayPosition(daysSince(DAILY_EPOCH, todayLocal()));
    setCleared(loadCleared());
    setReady(true);
  }, []);

  const visible: LibraryPuzzle[] = useMemo(
    () => (ready ? mapLibraryContent(puzzles, schedule, todayPosition) : []),
    [ready, puzzles, schedule, todayPosition],
  );

  const groups = useMemo(() => {
    const bySize = new Map<number, LibraryPuzzle[]>();
    for (const p of visible) {
      const arr = bySize.get(p.size) ?? [];
      arr.push(p);
      bySize.set(p.size, arr);
    }
    return [...bySize.entries()].sort((a, b) => a[0] - b[0]);
  }, [visible]);

  const clearedCount = visible.filter((p) => isCleared(cleared, p.id)).length;

  if (!ready) return <main className="flex flex-1 flex-col items-center px-6 py-10" />;

  if (visible.length === 0) {
    return (
      <main className="flex flex-1 flex-col items-center px-6 py-10">
        <div className="rounded-2xl bg-card p-6 text-center">
          <h2 className="text-xl font-semibold text-ink">The library&apos;s still growing 🌱</h2>
          <p className="mt-2 text-sm text-ink-soft">Check back soon for more puzzles.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-full max-w-3xl">
        <div className="mb-6 flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold text-ink">Library</h1>
          <span className="text-sm font-semibold text-ink-soft">
            {clearedCount} / {visible.length} cleared
          </span>
        </div>
        {groups.map(([size, items]) => (
          <section key={size} className="mb-8">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">
              {size} × {size}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {items.map((p) => (
                <PuzzleTile key={p.id} puzzle={p} cleared={isCleared(cleared, p.id)} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
```

Then the route:

```tsx
// src/app/library/page.tsx
import { LibraryScreen } from "@/features/library/LibraryScreen";
import { fetchLibraryContent } from "@/lib/content/content";

// ISR: re-fetch published content ~hourly, like the Daily. Future-daily
// filtering + cleared state are resolved on the client.
export const revalidate = 3600;

export default async function LibraryPage() {
  const { puzzles, schedule } = await fetchLibraryContent();
  return <LibraryScreen puzzles={puzzles} schedule={schedule} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/features/library/LibraryScreen.test.tsx`
Expected: PASS (3 tests).

Note: confirm `DAILY_EPOCH` and `daysSince` are exported from `@/lib/daily` (they are re-exported via `list` and `schedule` through `src/lib/daily/index.ts`). If `DAILY_EPOCH` is not surfaced there, import it from `@/lib/daily/list` directly.

- [ ] **Step 5: Commit**

```bash
git add src/features/library/LibraryScreen.tsx src/features/library/LibraryScreen.test.tsx src/app/library/page.tsx
git commit -m "feat: add LibraryScreen browse grid + /library route"
```

---

### Task 8: LibraryPlayScreen + /library/[slug] route

**Files:**
- Create: `src/features/library/LibraryPlayScreen.tsx`
- Test: `src/features/library/LibraryPlayScreen.test.tsx`
- Create: `src/app/library/[slug]/page.tsx`

**Interfaces:**
- Consumes: `usePuzzleGame` + `PuzzleGameSnapshot` from `@/features/play/usePuzzleGame`; `Board` from `@/features/play/Board`; `formatTime` from `@/features/play/format`; `loadLibraryStore`, `saveBoard`, `dropBoard`, `boardFor` from `@/lib/library/store`; `recordCleared` from `@/lib/library/cleared`; `LibraryPuzzle` type; Next `Link`, `notFound`.
- Produces: `LibraryPlayScreen({ puzzle }: { puzzle: LibraryPuzzle })` — client component. Resumes any saved board, autosaves on change, on win records the id + drops the board, shows a win card with "Play again" + "Back to library". (Future-daily 404 is handled in the route via `mapLibraryContent` membership; see Step 3 route code.)

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/library/LibraryPlayScreen.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LibraryPlayScreen } from "./LibraryPlayScreen";
import { loadCleared } from "@/lib/library/cleared";
import { loadLibraryStore, boardFor, saveBoard } from "@/lib/library/store";
import type { LibraryPuzzle } from "@/lib/content/content";

// 2x2: solution fills the whole grid → fill both cells in each row to win.
const PUZZLE: LibraryPuzzle = {
  id: "id-2x2",
  slug: "block",
  name: "Block",
  size: 2,
  rows: ["##", "##"],
  difficulty: "forager",
};

beforeEach(() => {
  window.localStorage.clear();
});

function fillEntireGrid() {
  // Board exposes a cell button per coordinate; fill all 4.
  const cells = screen.getAllByRole("button", { name: /cell|row|column|fill/i });
  // Fallback: click all gridcell-like buttons. The Board renders pressable cells.
}

describe("LibraryPlayScreen", () => {
  it("renders the puzzle board with its size", () => {
    render(<LibraryPlayScreen puzzle={PUZZLE} />);
    expect(screen.getByText(/2\s*×\s*2/)).toBeInTheDocument();
  });

  it("resumes from a saved in-progress board", () => {
    saveBoard("id-2x2", { cells: [[1, 0], [0, 0]], completed: false, elapsedMs: 5000 });
    render(<LibraryPlayScreen puzzle={PUZZLE} />);
    // the saved board is seeded; at least one filled cell is present (pressed state)
    const pressed = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed.length).toBeGreaterThan(0);
  });

  it("offers a Back to library link", () => {
    render(<LibraryPlayScreen puzzle={PUZZLE} />);
    expect(screen.getByRole("link", { name: /back to library/i })).toHaveAttribute(
      "href",
      "/library",
    );
  });
});
```

Note: the exact win-interaction selectors depend on `Board`'s cell roles. Before writing the test, open `src/features/play/Board.tsx` and `src/features/daily/DailyBoard.tsx` (or `DailyScreen.test.tsx`, which already drives a board to a win) and copy that exact win-driving interaction to add a fourth test: "on win, records to ledger and drops the in-progress board" asserting `loadCleared().ids` includes `"id-2x2"` and `boardFor(loadLibraryStore(), "id-2x2")` is `undefined`. Reuse the proven cell-clicking helper from `DailyScreen.test.tsx` rather than inventing selectors.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/features/library/LibraryPlayScreen.test.tsx`
Expected: FAIL — cannot find module `./LibraryPlayScreen`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/features/library/LibraryPlayScreen.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LibraryPuzzle } from "@/lib/content/content";
import { usePuzzleGame, type PuzzleGameSnapshot } from "@/features/play/usePuzzleGame";
import { Board } from "@/features/play/Board";
import { formatTime } from "@/features/play/format";
import type { Mode } from "@/features/play/reducer";
import { recordCleared } from "@/lib/library/cleared";
import { loadLibraryStore, saveBoard, dropBoard, boardFor } from "@/lib/library/store";

const MODES: { value: Mode; label: string }[] = [
  { value: "fill", label: "Fill" },
  { value: "mark", label: "Mark" },
];

export function LibraryPlayScreen({ puzzle }: { puzzle: LibraryPuzzle }) {
  // Resolve the saved board client-side before mounting the game (mirrors
  // DailyScreen: usePuzzleGame's lazy init must see `initial` on first render).
  const [ready, setReady] = useState(false);
  const [initial, setInitial] = useState<PuzzleGameSnapshot | undefined>(undefined);

  useEffect(() => {
    const saved = boardFor(loadLibraryStore(), puzzle.id);
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only bootstrap: read saved board once after mount before mounting the game.
      setInitial({ cells: saved.cells, won: saved.completed, frozenElapsed: saved.elapsedMs });
    }
    setReady(true);
  }, [puzzle.id]);

  if (!ready) return <main className="flex flex-1 flex-col items-center px-6 py-10" />;
  return <LibraryBoard puzzle={puzzle} initial={initial} />;
}

function LibraryBoard({
  puzzle,
  initial,
}: {
  puzzle: LibraryPuzzle;
  initial: PuzzleGameSnapshot | undefined;
}) {
  const persist = (snap: PuzzleGameSnapshot) => {
    if (snap.won) {
      recordCleared(puzzle.id);
      dropBoard(puzzle.id);
    } else {
      saveBoard(puzzle.id, {
        cells: snap.cells,
        completed: false,
        elapsedMs: snap.frozenElapsed,
      });
    }
  };

  const game = usePuzzleGame([puzzle], { initial, onChange: persist });

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-fit">
        <div className="mb-5 flex items-start justify-between gap-7">
          <div className="flex flex-col gap-[3px]">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[1.3px] text-ink-soft">
              {puzzle.name}
            </span>
            <span className="text-[2.5rem] font-semibold leading-none text-ink">
              {puzzle.size} × {puzzle.size}
            </span>
          </div>
          <div className="inline-flex min-w-[88px] items-center rounded-pill bg-pill px-[15px] py-[9px]">
            <span className="font-mono text-xl font-semibold tabular-nums text-ink">
              {formatTime(game.elapsedMs)}
            </span>
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
            <button
              type="button"
              onClick={game.reset}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-ink-soft hover:text-ink"
            >
              Reset
            </button>
            <Link
              href="/library"
              className="rounded-xl bg-pill px-4 py-2 text-sm font-semibold text-ink hover:opacity-90"
            >
              Back to library
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
              <Link
                href="/library"
                className="rounded-xl bg-pill px-4 py-2 text-sm font-semibold text-ink hover:opacity-90"
              >
                Back to library
              </Link>
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

        <div role="status" aria-live="polite" className="sr-only">
          {game.won ? `Picture complete — it's a ${puzzle.name.toLowerCase()}.` : ""}
        </div>
      </div>
    </main>
  );
}
```

Then the route (server component): resolve the puzzle by slug from the **library set** (so future dailies 404 too):

```tsx
// src/app/library/[slug]/page.tsx
import { notFound } from "next/navigation";
import { LibraryPlayScreen } from "@/features/library/LibraryPlayScreen";
import { fetchLibraryContent, mapLibraryContent } from "@/lib/content/content";
import { daysSince, DAILY_EPOCH } from "@/lib/daily";

export const revalidate = 3600;

export default async function LibraryPlayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { puzzles, schedule } = await fetchLibraryContent();
  // Server can't know the player's timezone; use a UTC-based today for the
  // membership 404. The exact local-day edge is cosmetic here — a puzzle that is
  // "tomorrow" in one timezone is still excluded within ~a day. Client screens
  // use local date for display/filtering.
  const todayPosition = daysSince(DAILY_EPOCH, new Date().toISOString().slice(0, 10));
  const puzzle = mapLibraryContent(puzzles, schedule, todayPosition).find(
    (p) => p.slug === slug,
  );
  if (!puzzle) notFound();
  return <LibraryPlayScreen puzzle={puzzle} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/features/library/LibraryPlayScreen.test.tsx`
Expected: PASS (3–4 tests, incl. the copied win-driving test).

- [ ] **Step 5: Commit**

```bash
git add src/features/library/LibraryPlayScreen.tsx src/features/library/LibraryPlayScreen.test.tsx "src/app/library/[slug]/page.tsx"
git commit -m "feat: add LibraryPlayScreen + /library/[slug] route with resume + ledger on win"
```

---

### Task 9: Daily completion writes the shared ledger

**Files:**
- Modify: `src/features/daily/DailyScreen.tsx` (in `onWin`, also `recordCleared(puzzle.id)`)
- Modify: `src/features/daily/DailyScreen.test.tsx` (add an assertion that a daily win records the puzzle id in the ledger)

**Interfaces:**
- Consumes: `recordCleared` from `@/lib/library/cleared`.
- Produces: nothing new — a one-line coherence hook so daily completions appear cleared on the Library wall.

- [ ] **Step 1: Write the failing test** (add to `DailyScreen.test.tsx`)

```tsx
import { loadCleared } from "@/lib/library/cleared";

it("records the daily puzzle in the completion ledger on win", () => {
  // Render the daily on its epoch date and drive the board to a win using the
  // SAME helper the existing win test uses, then assert the ledger.
  // (Reuse the existing test's setup/clicks; after the win:)
  expect(loadCleared().ids).toContain(SPROUT.id);
});
```

Implementation guidance: locate the existing "completes the daily" win test in `DailyScreen.test.tsx`, and either extend it with the `loadCleared().ids` assertion or duplicate its win-driving steps into the new test above. Add `window.localStorage.clear()` is already in `beforeEach`. `SPROUT.id` is `"sprout"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/features/daily/DailyScreen.test.tsx`
Expected: FAIL — ledger empty (`recordCleared` not yet called from the daily).

- [ ] **Step 3: Write minimal implementation** (in `DailyScreen.tsx`)

Add the import:

```tsx
import { recordCleared } from "@/lib/library/cleared";
```

In the existing `onWin` handler, add the ledger write alongside the streak update:

```tsx
const onWin = () => {
  recordCleared(puzzle.id);
  setStore((s) => {
    const next: DailyStore = { ...s, streak: completeDaily(s.streak, today) };
    saveStore(next);
    return next;
  });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/features/daily/DailyScreen.test.tsx`
Expected: PASS (existing tests + the new ledger assertion).

- [ ] **Step 5: Commit**

```bash
git add src/features/daily/DailyScreen.tsx src/features/daily/DailyScreen.test.tsx
git commit -m "feat: daily win records puzzle in the shared completion ledger"
```

---

### Task 10: Full-suite green gate

**Files:** none (verification only).

- [ ] **Step 1: Run the whole test suite**

Run: `pnpm test:run`
Expected: PASS — all tests (existing + new) green.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 4: Production build**

Run: `pnpm build`
Expected: build succeeds; `/library` and `/library/[slug]` appear in the route output.

- [ ] **Step 5: Manual smoke (optional but recommended)**

Run: `pnpm dev`, then visit `/library` (grid groups by size, counter shows cleared/total), click a tile → play → win (tile reveals on return, counter bumps), and confirm the Daily/Library header links navigate. Verify a `?` future-daily slug 404s.

No commit (verification task).

---

## Self-Review

**Spec coverage:**
- Scope (exclude future dailies) → Task 3 (`mapLibraryContent`) + Task 8 route membership. ✓
- Collection-wall spoiler treatment → Task 5 (`PuzzleTile` locked/revealed). ✓
- Completion ledger → Task 1; in-progress boards → Task 2; auto-save/resume → Task 8. ✓
- Daily coherence hook → Task 9. ✓
- Shared header + routes → Task 6 + Tasks 7/8. ✓
- Grid grouped by size + counter → Task 7. ✓
- Approach A (reuse `usePuzzleGame`+`Board`) → Task 8. ✓
- Error/edge cases (unknown/future slug 404, empty state, DB error throw, corrupt/quota fallback, replay) → Tasks 1–3, 7, 8. ✓
- DifficultyBadge shared with Studio → Task 4. ✓
- Testing across pure modules + components → every task; full gate Task 10. ✓

**Placeholder scan:** No "TBD/TODO" left as deliverables. Two tasks (8, 9) intentionally instruct copying the *existing, proven* board-win interaction from `DailyScreen.test.tsx` rather than reprinting selectors that depend on `Board`'s internals — this is a directive to reuse known-good test code, not a vague placeholder.

**Type consistency:** `ClearedStore`/`recordCleared`/`isCleared`, `LibraryStore`/`LibraryBoard`/`saveBoard`/`dropBoard`/`boardFor`, `LibraryPuzzleRow`/`LibraryPuzzle`/`mapLibraryContent`/`fetchLibraryContent`, `PuzzleGameSnapshot` shape, and `DifficultyBadge` props are used consistently across tasks. Ledger keys by puzzle `id` everywhere (daily + library).

**Open verification flags for the implementer (resolve during the task, don't guess):**
- Task 4: confirm `bg-emerald/amber/rose` utilities exist in this Tailwind v4 + tokens setup; else use token-backed distinct colors.
- Task 6: insert `<AppHeader />` to match the actual `layout.tsx` body structure; update any daily/play test that asserted on the in-header toggle.
- Tasks 8 & 9: reuse the exact win-driving cell interaction from `DailyScreen.test.tsx`.
- Task 7: confirm `DAILY_EPOCH` + `daysSince` are exported from `@/lib/daily` (else import from `@/lib/daily/list` / `@/lib/daily/schedule`).
