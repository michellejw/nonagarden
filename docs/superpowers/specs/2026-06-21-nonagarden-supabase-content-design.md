# Nonagarden — Supabase Content Backend (Slice 2) Design Spec

**Date:** 2026-06-21
**Project:** Nonagarden — the first Shroom Games *web* game (cozy nonogram / Picross).
**Slice:** 2 of N — **Supabase content backend**. The puzzle + schedule data store that the Daily reads from today, and that the future Studio authoring tool will write into.
**Status:** Approved design, ready for implementation plan.

---

## Context

Slices 1 (Core Play) and 3 (Daily) are built and merged. The Daily currently reads **bundled** content: puzzle pictures from `src/lib/puzzles/builtins.ts` (`BUILTINS`) and the ordered daily schedule from `src/lib/daily/list.ts` (`DAILY_LIST` + `DAILY_EPOCH`). Its pure logic — `dailyFor` / `daysSince` (`schedule.ts`), streak transitions (`streak.ts`), the versioned `localStorage` store (`store.ts`) — is solid and exhaustively unit-tested.

This slice moves the **content source** from bundled code to a Supabase Postgres database, **without touching that pure logic**. The seam is precise: `DailyScreen` resolves today's puzzle by calling `dailyFor(today)` (which returns a `puzzleId`) and looking that id up in a `Map` built from `BUILTINS`. So "content source" is two things — the **schedule** (an ordered list of ids + an epoch) and the **puzzle data** (the pictures). Both move to the DB; `dailyFor` already accepts the schedule list as a parameter (`dailyFor(date, list, epoch)`), so re-pointing is a matter of *where the list and puzzles come from*, not *how the daily is computed*.

The Daily is the schema's **first consumer**, but the schema is designed to also serve the later Studio (writes), Library (browse), and Archive (replay past dailies) slices.

### Decisions settled during brainstorming (2026-06-21)

- **Schedule model = ordered, append-only positions** (`daily_schedule(position int, puzzle_id)`, positions `0..N`). The runtime fetches the ordered ids and hands the array to the **existing `dailyFor` unchanged**. The epoch stays a code constant. *(Rejected: explicit `scheduled_date` per row — it would require rewriting `dailyFor` into a date-keyed lookup, breaking the "logic stays as-is" promise; calendar-date pinning is YAGNI given the pool model is append-only, and is a cheap additive migration later if ever wanted.)*
- **Difficulty is stored, not recomputed.** A `difficulty` column is written once at publish/seed time by the real grader (`difficultyOf`) and treated as a validated denormalized cache, so Library/Archive can filter in SQL without running the solver per puzzle.
- **`id` is a uuid; puzzles also carry a human-readable `slug`.** uuids are collision-safe for machine authoring (Studio); the `slug` (e.g. `"sprout"`) gives readable references and an idempotent upsert key for seeding.
- **Content freshness = ISR.** The page is statically rendered and revalidated on a timer (~hourly); newly published content appears without a redeploy. Past-stability and determinism come from the append-only schedule + `dailyFor`, **independent of the cache**.
- **One hosted Supabase project, shared dev/prod for now**, schema as version-controlled SQL migrations. (Solo, pre-launch — separating a local dev DB is a YAGNI we can add later in minutes.)
- **Players stay anonymous / local-only.** Supabase auth is *only ever the author's*, and only for writes. RLS: published puzzles + schedule are world-readable; writes are locked to an authenticated user.

## Goals

- Define a Postgres schema (`puzzles`, `daily_schedule`) that faithfully represents today's `Puzzle` shape and serves the future Studio / Library / Archive.
- Enforce **minimal RLS**: anonymous public reads of *published* content; writes restricted to an authenticated author.
- Re-point the Daily's content source from bundled data to the DB via a **server-side, ISR-cached fetch**, passing puzzles + schedule into `DailyScreen` as props — leaving `dailyFor` / streak / store **byte-for-byte unchanged**.
- Preserve the quality gate: every seeded/published puzzle is **unique, line-solvable, and graded**, validated at write time by the real solver — without making the unit-test suite depend on a live database.
- Provide a reproducible, idempotent **seed** that loads the carried-over bundled content into the DB.

## Non-goals (explicit YAGNI for this slice)

- **No author login UI and no auth flow.** The RLS write-lock is written now (schema is secure from day one); the *door* — sign-in + the write paths — ships with **Studio**. Seeding goes through the secret key (`sb_secret_...`), which bypasses RLS, so this slice needs no login.
- **No write paths from the app**: no create / edit / publish / schedule UI; no image import, draw-on-grid, or live grading. All Studio.
- **No Library or Archive UI.** This slice provisions the data those slices read; it renders no browse/replay affordance.
- **No calendar-date scheduling**, no per-row scheduled dates, no holiday pinning.
- **No separate local dev database / Docker stack**, no cross-device sync, no realtime.
- **No change to the pure daily logic** (`schedule.ts`, `streak.ts`, `store.ts`) or the board engine.

---

## Architecture

A new content data-access layer feeding the existing UI; the Daily page becomes a Server Component that fetches and passes content down.

```
supabase/
  migrations/
    0001_content.sql      puzzles + daily_schedule tables, indexes, RLS policies
  seed/
    seed.ts               idempotent seed: validate (solver) → upsert puzzles → write schedule (secret key)
src/lib/content/
  client.ts               server-side Supabase read client (publishable key) + seed/admin client (secret key)
  content.ts              fetchDailyContent(): { puzzles: Puzzle[]; schedule: string[] } — maps DB rows → Puzzle
  content.test.ts         mapping/ordering/filter tests against a MOCKED client (no live network)
src/app/page.tsx          Server Component: fetch (ISR) → <DailyScreen puzzles schedule/>
src/features/daily/
  DailyScreen.tsx         now prop-driven for content (puzzles + schedule props; no BUILTINS/DAILY_LIST import)
src/lib/daily/list.ts     keeps DAILY_EPOCH (code constant); DAILY_LIST stays as the seed snapshot
src/lib/puzzles/builtins.ts   unchanged — the bundled starter content, now consumed by the SEED + the /play dev harness
```

**Guiding principle:** the move is a *content-source swap behind an unchanged interface*. `dailyFor(date, list, epoch)` already takes the schedule as an argument; we just supply a DB-sourced `list` and a DB-sourced puzzle `Map`. Nothing about determinism, past-stability, streaks, or persistence changes.

### 1. Database schema (`supabase/migrations/0001_content.sql`)

```sql
create table puzzles (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique,                       -- human-readable, stable; seed upsert key (nullable for Studio puzzles)
  name        text not null,                     -- hidden answer, revealed on win
  size        int  not null check (size between 1 and 25),
  rows        text[] not null,                   -- solution; same "#.#.." format as today's Puzzle.rows
  difficulty  text not null check (difficulty in ('forager','woodlander','mycologist')),
  status      text not null default 'draft' check (status in ('draft','published')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table daily_schedule (
  position    int  primary key,                  -- 0-indexed; APPEND-ONLY (see note)
  puzzle_id   uuid not null references puzzles(id),
  created_at  timestamptz not null default now()
);

create index puzzles_status_idx on puzzles(status);
```

- **`rows text[]`** mirrors today's `Puzzle.rows` 1:1, so the DB→`Puzzle` mapping is trivial and lossless. `size` is stored (not derived) so Library can filter without parsing.
- **Append-only `position`** is the DB analogue of the in-code `DAILY_LIST` discipline: positions are assigned `0,1,2,…` and never reordered. Inserting/reordering would retroactively change past dailies. This is a *discipline* (Postgres can't cheaply enforce "append-only"); the seed writes `0..N` in `DAILY_LIST` order, and Studio (later) appends `max(position)+1`. The existing pure pinning test (below) guards the seed order; runtime order is preserved by the append-only write discipline.
- **Scheduled puzzles must be published.** The runtime query returns only schedule rows whose puzzle is `published`; the seed only schedules published puzzles. A scheduled-but-unpublished puzzle would surface as a `none`/caught-up gap rather than an error (see Risks: unpublishing).

### 2. Row-Level Security (in the same migration)

```sql
alter table puzzles        enable row level security;
alter table daily_schedule enable row level security;

-- Anonymous players: read PUBLISHED puzzles only (drafts stay private).
create policy "public read published puzzles"
  on puzzles for select using (status = 'published');

-- Anonymous players: read the schedule.
create policy "public read schedule"
  on daily_schedule for select using (true);

-- Author (any authenticated user — solo for now): full read/write, incl. drafts.
create policy "authenticated write puzzles"
  on puzzles for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "authenticated write schedule"
  on daily_schedule for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
```

- **Table privileges are granted explicitly.** The project is created with *"Automatically expose new tables" OFF* (Supabase's recommended, control-it-manually posture) and *"Enable automatic RLS" ON* (belt-and-suspenders). Because auto-expose is off, the migration **must** explicitly grant Data-API access or reads silently return nothing:
  ```sql
  grant select on puzzles, daily_schedule to anon, authenticated;
  grant insert, update, delete on puzzles, daily_schedule to authenticated;
  ```
  RLS policies (below) still gate *which rows* each role sees; these grants only open the table to the Data API at all.
- The **anon** role (the public browser key) can only `select` published puzzles + the schedule. It cannot read drafts or write anything.
- **Authenticated** = the author. Since the suite is solo, "authenticated" *is* the author; narrowing to a specific `auth.uid()` is a trivial Studio-era refinement, noted not built.
- The **seed/admin** path uses the secret key (`sb_secret_...`), which **bypasses RLS entirely** — so seeding needs no login and no policy carve-out.

### 3. Content data layer (`src/lib/content/`)

**`client.ts`** — two factory functions over `@supabase/supabase-js`:
- `createReadClient()` — uses `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; used by the Server Component. Read-only by virtue of RLS.
- `createAdminClient()` — uses `SUPABASE_SECRET_KEY` (server/seed only; never `NEXT_PUBLIC_`); used by the seed script.

**`content.ts`** — the single mapping seam:
```ts
fetchDailyContent(): Promise<{ puzzles: Puzzle[]; schedule: string[] }>
```
- Fetches all `published` puzzles → maps each DB row to the existing `Puzzle` shape (`{ id, name, size, rows }`; `slug`/`difficulty`/`status`/timestamps are dropped at this boundary — the Daily doesn't need them).
- Fetches `daily_schedule` and builds `schedule` as an array **indexed by `position`** (puzzle id placed at `schedule[position]`; any positional hole filled with `""`) — exactly the array `dailyFor` expects. **Positional alignment is preserved, never compacted**: a position whose puzzle isn't in the published set leaves an id that won't resolve in the screen's `byId` map, surfacing as a gap (caught-up) *for that day only* — it must never shift later days' indices, or past-stability breaks.
- Returns the full published set + full schedule (dozens of rows at this scale), so the **client** can resolve whatever its **local** date is — the server can't know the player's timezone. Windowing is a future-scale concern (YAGNI).

### 4. Daily page + screen (the re-point)

**`src/app/page.tsx`** becomes an async Server Component:
```tsx
export const revalidate = 3600; // ISR: re-fetch content ~hourly; no redeploy needed for new puzzles
export default async function Home() {
  const { puzzles, schedule } = await fetchDailyContent();
  return <DailyScreen puzzles={puzzles} schedule={schedule} />;
}
```
The Supabase reads happen at build time and on each revalidation, **not per request** — fast for players, fresh within the window. (On-demand revalidation triggered by a Studio publish is a clean future addition; not built here.)

**`src/features/daily/DailyScreen.tsx`** — the *only* functional change: it stops importing `BUILTINS` and stops calling `dailyFor(today)` with the bundled default, and instead receives content as props:
```tsx
export function DailyScreen({
  puzzles, schedule, nowDate,
}: { puzzles: Puzzle[]; schedule: readonly string[]; nowDate?: string }) {
  const byId = useMemo(() => new Map(puzzles.map((p) => [p.id, p])), [puzzles]);
  const result = useMemo(() => (today ? dailyFor(today, schedule) : null), [today, schedule]);
  // …everything else (store load, resume, persist, onWin, streak, all states) is UNCHANGED.
}
```
The client-only bootstrap (resolve local `today` + load `localStorage` after mount, skeleton-until-ready) is **unchanged** — content props arrive from the server and combine with the client-resolved date exactly as `BUILTINS`/`DAILY_LIST` did before.

**`DAILY_EPOCH`** stays in `src/lib/daily/list.ts` as a code constant (it's a fixed launch anchor — "what real date is position 0", a deployment fact, not content). `dailyFor` keeps using it.

### 5. Seed (`supabase/seed/seed.ts`)

A Node script (run locally with `pnpm seed`, using `createAdminClient`):
1. Reads the carried-over `BUILTINS` + `DAILY_LIST` (the in-code seed snapshot).
2. **Validates each puzzle with the real solver** — `cluesFor` → `lineSolve` (line-solvable) + `countSolutions` (exactly one solution) + `difficultyOf` (grade). Refuses to proceed if any puzzle fails (the same gate `content.test.ts` enforces).
3. **Upserts** puzzles on `slug` (idempotent — re-running doesn't duplicate), setting `status = 'published'` and the computed `difficulty`.
4. Resolves the inserted ids and writes `daily_schedule` rows at positions `0..N` in `DAILY_LIST` order.

The seed is the *only writer* in this slice and is the live home of the write-time validation gate (Studio inherits this gate later).

---

## Environment / secrets

Uses Supabase's **current API key types** (publishable / secret), which replace the legacy `anon` / `service_role` JWT keys. `.env.local` (gitignored), mirrored by a committed `.env.example` (keys only, no values):
```
NEXT_PUBLIC_SUPABASE_URL=…              # public — project address
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=…  # public — read token (sb_publishable_...), RLS-gated
SUPABASE_SECRET_KEY=…                   # SECRET — seed/admin only (sb_secret_...); bypasses RLS; never NEXT_PUBLIC_, never in the browser
```
- Prod (Vercel) needs `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the ISR fetch. The secret key is **not** needed in prod (the seed runs locally), so it stays out of the deployed environment.
- Migrations are applied to the hosted project via the Supabase CLI (`supabase/migrations/`).

---

## Testing

TDD, logic-first. `pnpm test` / `pnpm typecheck` / `pnpm lint` stay green; `pnpm build` succeeds. **No test touches a live Supabase.**

1. **Pure daily logic (`schedule` / `streak` / `store`) — UNCHANGED.** All existing tests, including the **pinning test** of fixed `(date → id)` pairs against `DAILY_LIST`, keep passing as-is; this slice does not modify those modules. The pinning test continues to guard the seed snapshot's past-stability.
2. **Content integrity — UNCHANGED in intent.** The existing `content.test.ts` (every `DAILY_LIST` id resolves to a real, unique, line-solvable, graded puzzle in `BUILTINS`) stays as the validation gate over the seed snapshot.
3. **Content data layer (`content.test.ts`, new) — mocked client.** With a stubbed Supabase client returning canned rows: `fetchDailyContent` maps rows → correct `Puzzle` shape; orders `schedule` by `position`; filters out non-published puzzles and dangling schedule entries; handles an empty DB gracefully (returns `{ puzzles: [], schedule: [] }`, which the Daily already renders as "caught up").
4. **`DailyScreen` — prop-driven.** Existing component tests are updated to pass `puzzles`/`schedule` props instead of relying on the `BUILTINS` import; **assertions and behavior are otherwise unchanged** (renders today's puzzle, resumes a stored board, completion card + streak, caught-up/`none` and before-epoch states). "today" is still injected.
5. **Seed validation.** The seed's validation step is unit-tested (it rejects a deliberately non-unique / non-solvable puzzle); the actual DB write is exercised manually against the hosted project, not in CI.
6. **Migration sanity.** The SQL migration is reviewed and applied to the project; RLS is spot-checked manually (the publishable key can read published, cannot read drafts or write; the secret key seeds successfully).

## Dependencies

- Add `@supabase/supabase-js` (runtime read client + admin seed client).
- Add `tsx` (dev) to run the TypeScript seed script — app source uses extensionless relative imports that plain Node ESM won't resolve; `tsx` does bundler-style resolution. (No `tsconfig-paths` needed: the seed's only `@/` import is type-only and erased.)
- A `pnpm seed` script: `node --env-file=.env.local --import tsx supabase/seed/seed.ts` — Node loads `.env.local`, `tsx` runs the TS.
- Supabase CLI used out-of-band for migrations (not a package dependency of the app).

## File layout (new / changed)

```
supabase/migrations/0001_content.sql        (new)  tables + indexes + RLS
supabase/seed/seed.ts                        (new)  idempotent, validated seed
src/lib/content/{client.ts, content.ts}      (new)  data-access layer
src/lib/content/content.test.ts              (new)  mapping tests (mocked client)
src/app/page.tsx                             (chg)  Server Component fetch + ISR + props
src/features/daily/DailyScreen.tsx           (chg)  prop-driven content (no BUILTINS/DAILY_LIST import)
src/features/daily/DailyScreen.test.tsx      (chg)  pass content as props
src/lib/daily/list.ts                        (kept) DAILY_EPOCH stays; DAILY_LIST = seed snapshot
src/lib/puzzles/builtins.ts                  (kept) bundled starter content → seed + /play harness
.env.example                                 (new)  key names only
package.json                                 (chg)  @supabase/supabase-js, seed script
```

`src/app/play/page.tsx` (the dev harness) continues importing `BUILTINS` directly — it's an out-of-product QA tool and intentionally stays bundled.

## Risks / notes

- **Append-only is still the whole ballgame** — now split across two places: the in-code `DAILY_LIST` (guarded by the pinning test) and the DB `daily_schedule.position` (guarded by write discipline + the seed writing in `DAILY_LIST` order). Studio must *append*, never reorder; the eventual Studio slice should add a runtime/CI guard analogous to the pinning test.
- **Unpublishing a scheduled puzzle breaks its past daily.** If a published, scheduled puzzle is later set to `draft` (or deleted), that date's daily becomes a gap. Invariant to enforce in Studio: a scheduled puzzle cannot be unpublished. Noted now, enforced later.
- **The in-code seed snapshot can drift from the DB once Studio writes directly.** After Studio exists, the DB is canonical and `BUILTINS`/`DAILY_LIST` are a historical "initial seed." This is acceptable and honest; the integrity test remains meaningful as a gate over *that snapshot*, not over live DB content (live content is gated at write time).
- **ISR window vs. expectations.** New content appears within the revalidate window (~hourly), not instantly. Fine for a daily; on-demand revalidation on Studio publish is the future upgrade.
- **Server can't know the player's timezone**, so the page ships the full published set + schedule and the client resolves the local date — same as today's bundled model. Safe at this scale; revisit only if the catalog grows large (windowing).
- **Two Supabase clients, two keys.** The secret key (`sb_secret_...`) must never reach the browser or `NEXT_PUBLIC_`. Keep `createAdminClient` out of any client-imported module; the seed is a standalone Node script.
