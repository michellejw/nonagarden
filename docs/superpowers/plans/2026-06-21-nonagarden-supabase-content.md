# Nonagarden — Supabase Content Backend (Slice 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Daily's content source from bundled code (`BUILTINS` + `DAILY_LIST`) to a Supabase Postgres database, without changing any of the pure daily logic (`dailyFor` / streak / store).

**Architecture:** A new content layer (`src/lib/content/`) holds a pure DB-row→`Puzzle` mapping (`mapContent`), a thin IO fetch (`fetchDailyContent`), the Supabase client factories, and reusable write-time validation (`gradeOrThrow`). The Daily page becomes an async Server Component that fetches published puzzles + the schedule (ISR-cached) and passes them as props into a now prop-driven `DailyScreen`. A `supabase/migrations` SQL file defines the schema + RLS; a `supabase/seed/seed.ts` script (run with `tsx`) validates and loads the carried-over bundled content.

**Tech Stack:** Next.js 16 (App Router, Server Components + ISR) + React 19 + TypeScript; `@supabase/supabase-js`; Supabase Postgres (hosted); Vitest + @testing-library/react + jsdom; `tsx` for the seed; pnpm; Node v25.

## Global Constraints

- **Pure daily logic is untouched.** `src/lib/daily/{schedule,streak,store}.ts` are NOT modified. `DAILY_EPOCH` stays a code constant in `src/lib/daily/list.ts`. `dailyFor(date, list, epoch)` already accepts the schedule as a parameter — we supply a DB-sourced `list`.
- **Schedule = ordered, append-only positions.** `daily_schedule(position int pk, puzzle_id uuid)`; positions `0..N`. **Never reorder or compact.** The mapping places each id at `schedule[position]` and fills holes with `""` — compacting would shift later days and break past-stability.
- **Players are anonymous.** Supabase auth is only ever the author's; this slice builds **no login UI and no app write paths**. Seeding uses the secret key (bypasses RLS).
- **Two keys, two clients.** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (browser-safe read, `sb_publishable_...`) and `SUPABASE_SECRET_KEY` (server/seed only, `sb_secret_...`). The secret key must NEVER get a `NEXT_PUBLIC_` prefix or reach client code. `createAdminClient` is imported only by the seed.
- **Runtime imports the alias `@/`; seed-graph imports are relative.** `@/*`→`./src/*` works under vitest but not `tsx`. Any module the seed imports at runtime (`client.ts`, `validate.ts`, `builtins.ts`, `list.ts`) must use **relative** imports for runtime (value) imports. `import type` is erased and may use `@/`.
- **Project ref:** `mnofaedjhrnespytmier`. Env in `.env.local` (already scaffolded, gitignored).
- TDD where logic exists; manual verification for SQL/seed/IO. After every task: `pnpm test`, `pnpm typecheck`, `pnpm lint` green; `pnpm build` green at the end.
- Commit style: conventional commits (`feat:`, `test:`, `chore:`, `refactor:`).

---

## File Structure

```
supabase/
  migrations/0001_content.sql   puzzles + daily_schedule tables, indexes, grants, RLS
  seed/seed.ts                  idempotent seed (run via tsx): validate → upsert puzzles → write schedule
src/lib/content/
  content.ts                    PuzzleRow/ScheduleRow/DailyContent types, mapContent (pure), fetchDailyContent (IO)
  content.test.ts               mapContent + fetchDailyContent (stubbed client) tests
  client.ts                     createReadClient() (publishable) + createAdminClient() (secret)
  validate.ts                   gradeOrThrow(puzzle) — write-time uniqueness/solvability gate + difficulty
  validate.test.ts
src/features/daily/
  DailyScreen.tsx               (modify) prop-driven content: { puzzles, schedule } props; no BUILTINS/DAILY_LIST import
  DailyScreen.test.tsx          (modify) pass puzzles/schedule props
src/app/page.tsx                (modify) async Server Component: fetchDailyContent() + ISR → <DailyScreen .../>
src/lib/puzzles/builtins.ts     (kept) bundled starter content → consumed by seed + /play harness
src/lib/daily/list.ts           (kept) DAILY_EPOCH + DAILY_LIST = the validated seed snapshot
.env.example / .env.local       (already created)
package.json                    (modify) + @supabase/supabase-js, + tsx (dev), + "seed" script
```

---

### Task 1: Pure content mapping (`mapContent`)

The pure DB-row → `Puzzle` / schedule-array mapping. No Supabase, no IO — fully unit-tested.

**Files:**
- Create: `src/lib/content/content.ts`
- Test: `src/lib/content/content.test.ts`

**Interfaces:**
- Consumes: `Puzzle` from `@/lib/nonogram` (type only).
- Produces:
  - `interface PuzzleRow { id: string; name: string; size: number; rows: string[] }`
  - `interface ScheduleRow { position: number; puzzle_id: string }`
  - `interface DailyContent { puzzles: Puzzle[]; schedule: string[] }`
  - `mapContent(puzzleRows: PuzzleRow[], scheduleRows: ScheduleRow[]): DailyContent`

- [ ] **Step 1: Write the failing test**

`src/lib/content/content.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { mapContent } from "./content";

describe("mapContent", () => {
  it("maps puzzle rows to the Puzzle shape (dropping extra columns)", () => {
    const { puzzles } = mapContent(
      [{ id: "a", name: "Acorn", size: 5, rows: ["#####"] }],
      [],
    );
    expect(puzzles).toEqual([{ id: "a", name: "Acorn", size: 5, rows: ["#####"] }]);
  });

  it("orders the schedule by position regardless of input row order", () => {
    const { schedule } = mapContent(
      [],
      [
        { position: 2, puzzle_id: "c" },
        { position: 0, puzzle_id: "a" },
        { position: 1, puzzle_id: "b" },
      ],
    );
    expect(schedule).toEqual(["a", "b", "c"]);
  });

  it("fills positional holes with '' so indices stay aligned (never compacts)", () => {
    const { schedule } = mapContent(
      [],
      [
        { position: 0, puzzle_id: "a" },
        { position: 2, puzzle_id: "c" },
      ],
    );
    expect(schedule).toEqual(["a", "", "c"]);
  });

  it("returns empty content for empty inputs", () => {
    expect(mapContent([], [])).toEqual({ puzzles: [], schedule: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/lib/content/content.test.ts`
Expected: FAIL — `mapContent` is not defined / module not found.

- [ ] **Step 3: Write minimal implementation**

`src/lib/content/content.ts`:
```ts
import type { Puzzle } from "@/lib/nonogram";

/** A row from the `puzzles` table — only the columns the Daily consumes. */
export interface PuzzleRow {
  id: string;
  name: string;
  size: number;
  rows: string[];
}

/** A row from the `daily_schedule` table. */
export interface ScheduleRow {
  position: number;
  puzzle_id: string;
}

export interface DailyContent {
  puzzles: Puzzle[];
  /** Ordered so index === position; positional holes are "" (resolve to caught-up). */
  schedule: string[];
}

/**
 * Pure mapping from DB rows to the shape the Daily consumes. Positional
 * alignment is preserved (id placed at schedule[position]); NEVER compacted —
 * compacting would shift later days' indices and break past-stability.
 */
export function mapContent(
  puzzleRows: PuzzleRow[],
  scheduleRows: ScheduleRow[],
): DailyContent {
  const puzzles: Puzzle[] = puzzleRows.map((r) => ({
    id: r.id,
    name: r.name,
    size: r.size,
    rows: r.rows,
  }));

  const schedule: string[] = [];
  for (const r of scheduleRows) schedule[r.position] = r.puzzle_id;
  for (let i = 0; i < schedule.length; i++) {
    if (schedule[i] === undefined) schedule[i] = "";
  }

  return { puzzles, schedule };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/lib/content/content.test.ts`
Expected: PASS (4 tests). Then `pnpm typecheck` and `pnpm lint` green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/content/content.ts src/lib/content/content.test.ts
git commit -m "feat: add pure DB-row to Puzzle content mapping"
```

---

### Task 2: Supabase clients + `fetchDailyContent`

Install the client library, add the two client factories, and the IO fetch that delegates to `mapContent`. Tested with an injected stub client (no live network).

**Files:**
- Create: `src/lib/content/client.ts`
- Modify: `src/lib/content/content.ts` (append `fetchDailyContent`)
- Modify: `src/lib/content/content.test.ts` (append fetch tests)
- Modify: `package.json` (add dependency)

**Interfaces:**
- Consumes: `mapContent`, `PuzzleRow`, `ScheduleRow`, `DailyContent` (Task 1).
- Produces:
  - `createReadClient(): SupabaseClient` (publishable key)
  - `createAdminClient(): SupabaseClient` (secret key)
  - `fetchDailyContent(client?: Pick<SupabaseClient, "from">): Promise<DailyContent>`

- [ ] **Step 1: Install the Supabase client library**

Run: `pnpm add @supabase/supabase-js`
Expected: added to `dependencies` in `package.json`.

- [ ] **Step 2: Write the client factories**

`src/lib/content/client.ts`:
```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

/** Browser-safe read client (publishable key). RLS gates what it can read. */
export function createReadClient(): SupabaseClient {
  return createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  );
}

/**
 * Server/seed-only admin client (secret key). Bypasses RLS.
 * NEVER import this into client-bundled code.
 */
export function createAdminClient(): SupabaseClient {
  return createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SECRET_KEY"),
    { auth: { persistSession: false } },
  );
}
```

- [ ] **Step 3: Write the failing test for `fetchDailyContent`**

Append to `src/lib/content/content.test.ts`:
```ts
import { fetchDailyContent } from "./content";

describe("fetchDailyContent", () => {
  const puzzleRows = [{ id: "a", name: "Acorn", size: 5, rows: ["#####"] }];
  const scheduleRows = [{ position: 0, puzzle_id: "a" }];

  // Minimal stub of the Supabase query builder: `.from(t).select(c)` is awaitable
  // (schedule path) and also exposes `.eq()` returning a promise (puzzles path).
  function fakeClient(opts: { puzzleError?: unknown; scheduleError?: unknown } = {}) {
    return {
      from(table: string) {
        const res =
          table === "puzzles"
            ? { data: puzzleRows, error: opts.puzzleError ?? null }
            : { data: scheduleRows, error: opts.scheduleError ?? null };
        const thenable = {
          eq: () => Promise.resolve(res),
          then: (
            resolve: (v: unknown) => unknown,
            reject?: (e: unknown) => unknown,
          ) => Promise.resolve(res).then(resolve, reject),
        };
        return { select: () => thenable };
      },
    };
  }

  it("returns content mapped from both tables", async () => {
    const content = await fetchDailyContent(fakeClient() as never);
    expect(content.puzzles).toEqual([{ id: "a", name: "Acorn", size: 5, rows: ["#####"] }]);
    expect(content.schedule).toEqual(["a"]);
  });

  it("throws when the puzzles query errors", async () => {
    await expect(
      fetchDailyContent(fakeClient({ puzzleError: new Error("boom") }) as never),
    ).rejects.toThrow("boom");
  });

  it("throws when the schedule query errors", async () => {
    await expect(
      fetchDailyContent(fakeClient({ scheduleError: new Error("nope") }) as never),
    ).rejects.toThrow("nope");
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm test -- src/lib/content/content.test.ts`
Expected: FAIL — `fetchDailyContent` is not exported.

- [ ] **Step 5: Implement `fetchDailyContent`**

Append to `src/lib/content/content.ts`:
```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { createReadClient } from "./client";

/**
 * Fetch published puzzles + the full schedule and map to DailyContent.
 * `client` is injectable for tests; defaults to the publishable-key read client.
 * The full published set + schedule are returned so the CLIENT can resolve its
 * own local-date daily (the server can't know the player's timezone).
 */
export async function fetchDailyContent(
  client: Pick<SupabaseClient, "from"> = createReadClient(),
): Promise<DailyContent> {
  const [puzzleRes, scheduleRes] = await Promise.all([
    client.from("puzzles").select("id,name,size,rows").eq("status", "published"),
    client.from("daily_schedule").select("position,puzzle_id"),
  ]);
  if (puzzleRes.error) throw puzzleRes.error;
  if (scheduleRes.error) throw scheduleRes.error;
  return mapContent(
    (puzzleRes.data ?? []) as PuzzleRow[],
    (scheduleRes.data ?? []) as ScheduleRow[],
  );
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm test -- src/lib/content/content.test.ts`
Expected: PASS (7 tests). Then `pnpm typecheck` and `pnpm lint` green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/content/client.ts src/lib/content/content.ts src/lib/content/content.test.ts package.json pnpm-lock.yaml
git commit -m "feat: add Supabase clients and fetchDailyContent"
```

---

### Task 3: Database migration (schema + grants + RLS)

Write the SQL migration, apply it to the hosted project, and spot-check RLS. No automated test — verification is the applied schema + a publishable-key read returning `200 []` (RLS allows the query; nothing published yet).

**Files:**
- Create: `supabase/migrations/0001_content.sql`

- [ ] **Step 1: Write the migration**

`supabase/migrations/0001_content.sql`:
```sql
-- Nonagarden content backend (slice 2): puzzles + daily_schedule.

create table puzzles (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique,                          -- human-readable; seed upsert key (null for Studio puzzles)
  name        text not null,                        -- hidden answer, revealed on win
  size        int  not null check (size between 1 and 25),
  rows        text[] not null,                      -- solution; "#.#.." format, same as Puzzle.rows
  difficulty  text not null check (difficulty in ('forager','woodlander','mycologist')),
  status      text not null default 'draft' check (status in ('draft','published')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table daily_schedule (
  position    int  primary key,                     -- 0-indexed; APPEND-ONLY, never reordered
  puzzle_id   uuid not null references puzzles (id),
  created_at  timestamptz not null default now()
);

create index puzzles_status_idx on puzzles (status);

-- "Automatically expose new tables" is OFF, so grant Data-API access explicitly.
-- RLS (below) still decides WHICH rows each role sees; these grants only open
-- the tables to the API at all.
grant select on puzzles, daily_schedule to anon, authenticated;
grant insert, update, delete on puzzles, daily_schedule to authenticated;

-- Row-Level Security.
alter table puzzles        enable row level security;
alter table daily_schedule enable row level security;

-- Anonymous players read PUBLISHED puzzles only; drafts stay private.
create policy "public read published puzzles" on puzzles
  for select using (status = 'published');

-- The author (any authenticated user — solo for now) reads/writes everything.
create policy "author writes puzzles" on puzzles
  for all to authenticated using (true) with check (true);

-- Schedule is publicly readable; only the author writes it.
create policy "public read schedule" on daily_schedule
  for select using (true);

create policy "author writes schedule" on daily_schedule
  for all to authenticated using (true) with check (true);
```

- [ ] **Step 2: Apply the migration to the hosted project**

Primary (Supabase dashboard, lowest friction): open the project → **SQL Editor** → paste the full contents of `0001_content.sql` → **Run**. Expect "Success. No rows returned."

(Alternative, once the CLI is linked: `supabase link --project-ref mnofaedjhrnespytmier` then `supabase db push`.)

- [ ] **Step 3: Verify the tables + RLS**

In the dashboard **Table Editor**, confirm `puzzles` and `daily_schedule` exist with the columns above, and that both show **RLS enabled**.

Then verify the publishable-key read path works and is row-gated (run locally, reading the URL/key from `.env.local`):
```bash
source .env.local 2>/dev/null
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/puzzles?select=*" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
```
Expected: `[]` (HTTP 200 — the read is permitted by the grant + RLS, and there are no published rows yet). A `401/permission denied` here means the grants/RLS are wrong — fix before continuing.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0001_content.sql
git commit -m "feat: add Supabase content schema + RLS migration"
```

---

### Task 4: Content validation + seed script

Add the reusable write-time validation gate (`gradeOrThrow`, tested in the normal suite) and the seed script that validates + loads the bundled content into the DB.

**Files:**
- Create: `src/lib/content/validate.ts`
- Test: `src/lib/content/validate.test.ts`
- Create: `supabase/seed/seed.ts`
- Modify: `package.json` (add `tsx` dev dependency + `seed` script)

**Interfaces:**
- Consumes: `cluesFor`, `lineSolve`, `countSolutions`, `difficultyOf`, `Puzzle` from the nonogram engine (imported **relatively** as `../nonogram` so it runs under both vitest and `tsx`); `createAdminClient` (Task 2); `BUILTINS`, `DAILY_LIST`.
- Produces: `gradeOrThrow(puzzle: Puzzle): "forager" | "woodlander" | "mycologist"` (throws if not unique / not line-solvable).

- [ ] **Step 1: Write the failing test for `gradeOrThrow`**

`src/lib/content/validate.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { gradeOrThrow } from "./validate";

describe("gradeOrThrow", () => {
  it("returns a difficulty for a valid, unique, line-solvable puzzle", () => {
    const sprout = {
      id: "sprout",
      name: "Sprout",
      size: 5,
      rows: ["..#..", "..#..", "#.#.#", ".###.", "..#.."],
    };
    expect(["forager", "woodlander", "mycologist"]).toContain(gradeOrThrow(sprout));
  });

  it("throws for a puzzle with more than one solution", () => {
    // 2x2 with one filled per row/col is satisfied by BOTH diagonals → not unique.
    const ambiguous = { id: "bad", name: "Bad", size: 2, rows: ["#.", ".#"] };
    expect(() => gradeOrThrow(ambiguous)).toThrow(/solution/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/lib/content/validate.test.ts`
Expected: FAIL — `gradeOrThrow` is not defined.

- [ ] **Step 3: Implement `gradeOrThrow`**

`src/lib/content/validate.ts` (note the **relative** `../nonogram` import — must work under `tsx`):
```ts
import {
  cluesFor,
  lineSolve,
  countSolutions,
  difficultyOf,
  type Puzzle,
} from "../nonogram";

/**
 * Write-time content gate: assert a puzzle is line-solvable (no guessing) and
 * has exactly one solution, then return its graded difficulty. Throws otherwise.
 * Shared by the seed now and the Studio publish path later.
 */
export function gradeOrThrow(
  puzzle: Puzzle,
): "forager" | "woodlander" | "mycologist" {
  const { rowClues, colClues } = cluesFor(puzzle);

  const solved = lineSolve(rowClues, colClues, puzzle.size);
  if (!solved.solved) {
    throw new Error(`Puzzle "${puzzle.id}" is not line-solvable`);
  }

  const count = countSolutions(rowClues, colClues, puzzle.size, 2);
  if (!(count.status === "ok" && count.count === 1)) {
    throw new Error(`Puzzle "${puzzle.id}" does not have exactly one solution`);
  }

  return difficultyOf(rowClues, colClues, puzzle.size);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/lib/content/validate.test.ts`
Expected: PASS (2 tests). Then `pnpm typecheck` and `pnpm lint` green.

> If `difficultyOf`'s return type is not already the three-string union, the explicit return annotation above may error. In that case, change the annotation to `ReturnType<typeof difficultyOf>` and re-run.

- [ ] **Step 5: Add `tsx` and the seed script command**

Run: `pnpm add -D tsx`

Then add to `package.json` `"scripts"`:
```json
"seed": "node --env-file=.env.local --import tsx supabase/seed/seed.ts"
```

- [ ] **Step 6: Write the seed script**

`supabase/seed/seed.ts` (all runtime imports **relative**):
```ts
import { BUILTINS } from "../../src/lib/puzzles/builtins";
import { DAILY_LIST } from "../../src/lib/daily/list";
import { createAdminClient } from "../../src/lib/content/client";
import { gradeOrThrow } from "../../src/lib/content/validate";

async function main() {
  const sb = createAdminClient();

  // 1. Validate + upsert every bundled puzzle (idempotent on slug).
  for (const puzzle of BUILTINS) {
    const difficulty = gradeOrThrow(puzzle);
    const { error } = await sb.from("puzzles").upsert(
      {
        slug: puzzle.id,
        name: puzzle.name,
        size: puzzle.size,
        rows: puzzle.rows,
        difficulty,
        status: "published",
      },
      { onConflict: "slug" },
    );
    if (error) throw error;
  }

  // 2. Resolve slug -> uuid.
  const { data: rows, error } = await sb.from("puzzles").select("id,slug");
  if (error) throw error;
  const idBySlug = new Map(
    (rows ?? []).map((r) => [r.slug as string, r.id as string]),
  );

  // 3. Write the schedule at positions 0..N in DAILY_LIST order (idempotent on position).
  const scheduleRows = DAILY_LIST.map((slug, position) => {
    const puzzle_id = idBySlug.get(slug);
    if (!puzzle_id) throw new Error(`Schedule references unknown slug "${slug}"`);
    return { position, puzzle_id };
  });
  const { error: schedErr } = await sb
    .from("daily_schedule")
    .upsert(scheduleRows, { onConflict: "position" });
  if (schedErr) throw schedErr;

  console.log(
    `Seeded ${BUILTINS.length} puzzles, ${scheduleRows.length} schedule entries.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

- [ ] **Step 7: Run the seed against the hosted DB**

Ensure `.env.local` has all three values (incl. `SUPABASE_SECRET_KEY`), then run: `pnpm seed`
Expected: `Seeded 16 puzzles, 16 schedule entries.` (counts match `BUILTINS.length` / `DAILY_LIST.length`). Re-running must NOT duplicate (upserts) — run it twice and confirm the same counts.

- [ ] **Step 8: Verify the published read path now returns data**

```bash
source .env.local 2>/dev/null
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/daily_schedule?select=position,puzzle_id&order=position" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" | head -c 400
```
Expected: a JSON array of 16 rows, positions `0..15` in order.

- [ ] **Step 9: Commit**

```bash
git add src/lib/content/validate.ts src/lib/content/validate.test.ts supabase/seed/seed.ts package.json pnpm-lock.yaml
git commit -m "feat: add content validation gate and DB seed script"
```

---

### Task 5: Re-point the Daily to DB content

Make `DailyScreen` prop-driven (content from props, not `BUILTINS`/`DAILY_LIST`), update its tests, and turn `src/app/page.tsx` into an ISR-cached Server Component that fetches from the DB. The pure daily logic, board engine, store, and streak are untouched.

**Files:**
- Modify: `src/features/daily/DailyScreen.tsx`
- Modify: `src/features/daily/DailyScreen.test.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `fetchDailyContent` (Task 2); `dailyFor` (unchanged, called as `dailyFor(today, schedule)`).
- Produces: `DailyScreen({ puzzles, schedule, nowDate? })` where `puzzles: Puzzle[]`, `schedule: readonly string[]`.

- [ ] **Step 1: Write the failing test (proves the screen uses the prop schedule, not the bundled list)**

Add this test to `src/features/daily/DailyScreen.test.tsx` (inside the `describe`), and add `import type { Puzzle } from "@/lib/nonogram";` at the top:
```ts
it("uses the schedule prop, not the bundled DAILY_LIST (empty schedule → caught up)", async () => {
  // 2026-06-22 is the epoch (index 0). With the OLD bundled screen this renders
  // a grid; once prop-driven, an empty schedule resolves to caught-up.
  render(<DailyScreen puzzles={[]} schedule={[]} nowDate="2026-06-22" />);
  expect(await screen.findByText(/caught up/i)).toBeInTheDocument();
  expect(screen.queryByRole("grid")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/features/daily/DailyScreen.test.tsx`
Expected: FAIL — the current screen ignores props and renders the bundled "sprout" grid, so "caught up" is not found. (TypeScript may also flag the unknown `puzzles`/`schedule` props — that's expected; this test drives the signature change.)

- [ ] **Step 3: Make `DailyScreen` prop-driven**

In `src/features/daily/DailyScreen.tsx`:

(a) Remove the bundled import and module-level map:
```ts
// DELETE these two:
import { BUILTINS } from "@/lib/puzzles/builtins";
const byId = new Map(BUILTINS.map((p) => [p.id, p]));
```

(b) Add the `Puzzle` type import near the other imports:
```ts
import type { Puzzle } from "@/lib/nonogram";
```

(c) Change the component signature from `export function DailyScreen({ nowDate }: { nowDate?: string }) {` to:
```ts
export function DailyScreen({
  puzzles,
  schedule,
  nowDate,
}: {
  puzzles: Puzzle[];
  schedule: readonly string[];
  nowDate?: string;
}) {
```

(d) Inside the component, build `byId` from the prop and pass `schedule` to `dailyFor`. Replace the existing `const result = useMemo(...)` line with these two:
```ts
  const byId = useMemo(() => new Map(puzzles.map((p) => [p.id, p])), [puzzles]);
  const result = useMemo(
    () => (today ? dailyFor(today, schedule) : null),
    [today, schedule],
  );
```
(Everything else — the `useState`/`useEffect` bootstrap, store load/persist, `onWin`, streak, all the render branches — stays exactly as-is. A `schedule` hole `""` yields `dailyFor → { kind: "puzzle", puzzleId: "" }`, `byId.get("")` is undefined, and the existing fall-through renders the caught-up card.)

- [ ] **Step 4: Update the existing tests to pass content props**

In `src/features/daily/DailyScreen.test.tsx`, add a fixture after the `SPROUT_ROWS` setup:
```ts
const SPROUT: Puzzle = { id: "sprout", name: "Sprout", size: 5, rows: SPROUT_ROWS };
const PUZZLES: Puzzle[] = [SPROUT];
const SCHEDULE: string[] = ["sprout"];
```
Then update each existing `render(...)` call to pass the props:
- `render(<DailyScreen nowDate="2026-06-22" />)` → `render(<DailyScreen puzzles={PUZZLES} schedule={SCHEDULE} nowDate="2026-06-22" />)` (the two tests using the epoch date)
- `render(<DailyScreen nowDate="2099-01-01" />)` → `render(<DailyScreen puzzles={PUZZLES} schedule={SCHEDULE} nowDate="2099-01-01" />)`
- the "restores a completed-today board" test's `render(<DailyScreen nowDate="2026-06-22" />)` → same props as the epoch tests.

(The completed-today store fixture already uses `puzzleId: "sprout"`, which matches `SPROUT.id`.)

- [ ] **Step 5: Run the component tests to verify they pass**

Run: `pnpm test -- src/features/daily/DailyScreen.test.tsx`
Expected: PASS (all tests, including the new caught-up-via-prop test).

- [ ] **Step 6: Make the page a Server Component that fetches from the DB**

Replace the entire contents of `src/app/page.tsx`:
```tsx
import { DailyScreen } from "@/features/daily/DailyScreen";
import { fetchDailyContent } from "@/lib/content/content";

// ISR: re-fetch DB content ~hourly. New published puzzles appear without a
// redeploy. Past-stability/determinism come from the append-only schedule +
// dailyFor, independent of this cache.
export const revalidate = 3600;

export default async function Home() {
  const { puzzles, schedule } = await fetchDailyContent();
  return <DailyScreen puzzles={puzzles} schedule={schedule} />;
}
```

- [ ] **Step 7: Full verification (tests, types, lint, build, smoke)**

Run, expecting all green:
```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```
`pnpm build` exercises the real DB fetch — it must reach the seeded project (env from `.env.local`).

Smoke: `pnpm dev`, open `/`. Today (2026-06-21) is **before** the epoch (2026-06-22), so the **correct** state is the "caught up / garden opens" card with **no console/network errors** — confirm the Supabase requests for `puzzles` and `daily_schedule` return 200 in the Network tab. (Puzzle rendering itself is already proven by the component tests; to eyeball a real DB puzzle before the epoch, temporarily render `<DailyScreen ... nowDate="2026-06-22" />` in a scratch and revert.)

- [ ] **Step 8: Commit**

```bash
git add src/features/daily/DailyScreen.tsx src/features/daily/DailyScreen.test.tsx src/app/page.tsx
git commit -m "feat: re-point the Daily to Supabase content via ISR server fetch"
```

---

## Self-Review

**Spec coverage:**
- Schema (`puzzles`, `daily_schedule`, uuid id + slug, stored difficulty, status, timestamps) → Task 3. ✓
- Explicit grants (auto-expose off) + minimal RLS (public read published, authenticated writes) → Task 3. ✓
- Pure DB→Puzzle mapping with positional alignment / no compaction → Task 1. ✓
- ISR server fetch passing props; `dailyFor`/streak/store unchanged → Tasks 2, 5. ✓
- Write-time validation gate without live-DB tests → Task 4 (`gradeOrThrow` + unit test); seed reuses it. ✓
- Idempotent seed of carried-over `BUILTINS`/`DAILY_LIST` → Task 4. ✓
- New-key env (publishable/secret), two clients, secret never client-side → Task 2 + Global Constraints. ✓
- `DAILY_EPOCH` stays a code constant; `BUILTINS`/`DAILY_LIST` kept as seed snapshot → Global Constraints, File Structure. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code; commands have expected output. ✓

**Type consistency:** `PuzzleRow`/`ScheduleRow`/`DailyContent`/`mapContent` defined in Task 1 and consumed unchanged in Task 2; `fetchDailyContent` signature matches its use in Task 5's `page.tsx`; `DailyScreen` prop names (`puzzles`, `schedule`) consistent across Tasks 5 steps and `page.tsx`; `gradeOrThrow` return type reused by the seed. ✓

## Risks / notes

- **Append-only lives in two places now** (in-code `DAILY_LIST` guarded by the existing pinning test; DB `daily_schedule.position` guarded by seed order + write discipline). Studio must append, never reorder.
- **Build-time DB dependency:** `pnpm build` and each ISR revalidation hit Supabase; an unreachable/empty DB degrades to the caught-up state (no crash) but is worth noticing.
- **Unpublishing a scheduled puzzle** turns its day into a gap — invariant to enforce in Studio, not here.
- **`difficultyOf` return type:** if not the three-string union, use `ReturnType<typeof difficultyOf>` (noted in Task 4).
