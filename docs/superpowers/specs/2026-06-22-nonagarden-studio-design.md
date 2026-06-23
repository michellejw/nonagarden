# Nonagarden — Studio v1: Batch Authoring Pipeline (Slice 6) Design Spec

**Date:** 2026-06-22
**Project:** Nonagarden — the first Shroom Games *web* game (cozy nonogram / Picross).
**Slice:** 6 of N — **Studio v1**. The authoring tool that gets puzzles into the Supabase content backend with as little friction as possible.
**Status:** Approved design, ready for implementation plan.

---

## Context

Slices 1 (Core Play), 3 (Daily), and 2 (Supabase content backend) are built and merged. The Daily reads published puzzles + an append-only schedule from Supabase via an ISR Server Component; the pure `dailyFor` / streak / store logic is untouched. The write side of that backend has existed only as a one-shot **seed** script (`supabase/seed/seed.ts`) that loads bundled `BUILTINS` through the `gradeOrThrow` quality gate using the secret-key **admin client** (`createAdminClient`, bypasses RLS).

This slice builds the **author-facing way to create new puzzles and put them live** — the top priority after the backend landed. The driving goal (carried since the Daily slice) is **low-friction batch creation**: filling a backlog *pool* of puzzles opportunistically, not authoring one per day.

### The pivot settled during brainstorming (2026-06-22)

The slice was originally framed as a web "Studio": author login (Supabase auth) + draw-on-grid canvas + live grading + publish. Two of Michelle's instincts collapsed that into something much smaller:

1. **"Should Claude author the puzzles in a batch?"** A spike measured the real constraint. The hard part of authoring splits in two: (a) making a *valid* puzzle — unique, line-solvable, graded — which is **already fully automated** by the engine (`gradeOrThrow`), and (b) making a *recognizable, charming* picture — a visual-judgment task. The spike hand-authored 8 small grids (heart, mushroom, tree, house, cat, apple, diamond, sailboat) and ran them through the real engine: **8/8 graded valid**, ~6–7 clearly recognizable. Conclusion: **Claude can batch-generate valid, recognizable small nonograms at a high hit rate.** Generation is Claude's job; the engine validates; the human curates. (Honest caveats: the spike used easy chunky/symmetric subjects that both render well and grade cleanly; sparser/asymmetric pictures will fail uniqueness more — but the engine rejects those for free, so they never reach the author. Recognizability is subjective and stays a human keep/reject call.)

2. **"Building and maintaining an auth system for ONE user is too much."** Correct, and unnecessary: the admin client + the secret key already in `.env.local` authorizes all writes from Michelle's machine. A **local, no-auth** tool needs no login UI and no `@supabase/ssr`. "Being the author" reduces to "having the secret key on your laptop." The RLS `authenticated`-write policies stay as harmless future-proofing for eventual community authoring.

Together these make Studio v1 a **local batch authoring pipeline**, not a web app: Claude generates candidate grids → a render utility produces a static HTML gallery → Michelle eyeballs and picks keepers → a publish script validates and writes them live. The durable artifact is small (render + gallery + planners + scripts), all built on the existing engine and admin client.

### Decisions settled during brainstorming (2026-06-22)

- **Review surface = generated static HTML gallery.** Candidates render as real grids (not terminal ASCII) + name + size + difficulty, opened in a browser. *(Rejected for v1: a local web review app with keep/reject toggles — more to build/maintain than a one-user loop needs; in-chat ASCII — a rougher preview than HTML.)*
- **No emoji / image / icon import — at all.** Batch generation is the main pipeline; import is not wanted. *(This closes the long-parked "image import" question from the daily-content-pipeline note: dropped, not deferred-with-intent.)*
- **No auth, no login UI, no `@supabase/ssr`.** Local-only writes via the existing admin client + secret key.
- **No draw-on-grid canvas in v1**, because a high generation hit rate means "fix the almost-right one" is a conversational regenerate, not a drawing UI.
- **Publish ≠ schedule.** Publishing adds a puzzle to the *pool* (`status = 'published'`); scheduling separately appends it to `daily_schedule`. This honors the "pool, not per-day" model — bank a backlog, schedule from it to extend the daily runway.
- **Studio puzzles get slugs** (kebab IDs), a deliberate deviation from the schema comment's "slug null for Studio." A stable upsert key matters more than the comment's intent; it makes re-runs idempotent.
- **Sizes stay small** (≤ ~15, as today). Larger grids and color are explicitly future (see Non-goals / Future doors).

## Goals

- Provide a repeatable, **local, no-auth** pipeline to take a batch of candidate puzzles from generation to live in the DB.
- **Reuse the engine as the quality gate**: every published puzzle passes `gradeOrThrow` (unique, line-solvable) and carries its graded difficulty — no bad puzzle reaches the pool.
- Give Michelle an **accurate visual review surface** (HTML gallery rendering real grids + difficulty + size), including *invalid* candidates marked with the engine's rejection reason, so the gallery doubles as a generation-quality view.
- Keep **publish and schedule as separate operations** so a backlog pool can be banked and scheduled from independently.
- Make all writes **idempotent and safe to re-run** (slug-keyed upserts; append-only schedule guarded against double-adds).
- Keep every non-trivial piece **pure and unit-tested**, matching the Daily/Supabase "pure logic + thin client shell" pattern.
- **Leave the door open** for a future interactive designer: every module operates on plain `Puzzle[]`, so a designer (or any other producer) feeds the same render/grade/publish path unchanged.

## Non-goals (explicit YAGNI for this slice)

- **No author login UI, no auth flow, no `@supabase/ssr`.** Writes go through the secret-key admin client locally.
- **No interactive draw-on-grid designer** and no live in-browser grading UI. (Architecture stays designer-ready; the feature is a future slice.)
- **No emoji / image / icon import.** Dropped for the project's current direction, not parked.
- **No Library or Archive UI**, no in-app editing of existing puzzles.
- **No larger grids (25–30) and no color nonograms.** These are wanted *eventually* but are their own future slices: the current solver has a 400k-node budget (`countSolutions`) that large grids may exceed (→ graded as "not exactly one solution"), and color is a different content model entirely. Flagged here so the limitation is on record, not discovered later.
- **No deployment of any Studio surface.** The gallery is a local file; the scripts run on Michelle's machine.

---

## Architecture

Two layers, mirroring the existing codebase: **pure modules** (`src/lib/studio/`) that do all the real work and are unit-tested, and **thin operational scripts** (`studio/`, a sibling of `supabase/`) that wire them to the filesystem and the admin client.

### Pure modules — `src/lib/studio/`

- **`render.ts`** — pure grid rendering. Turns a `Puzzle` (its solution `rows`) into a visual: an HTML grid fragment (filled/empty cells) for the gallery, and optionally a text/block form. Input-agnostic and reused by any future designer.
- **`gallery.ts`** — `buildGalleryHtml(items): string`. Given graded candidates, emits a complete static HTML page: each candidate as a rendered grid + name + size + **difficulty badge**. **Invalid candidates are included**, visually marked with the engine's rejection reason. Self-contained (inline CSS), no server needed.
- **`plan.ts`** — the brains, pure and DB-free:
  - `planPublish(candidates, approvedIds)` → for each approved candidate, run `gradeOrThrow`; return `{ valid: rows-with-difficulty[], rejected: {id, reason}[] }`. Rows are in the exact `puzzles`-table shape (slug, name, size, rows, difficulty, status `'published'`).
  - `planSchedule(approvedSlugs, existingSchedule)` → positions to append, starting after the current max position, **skipping slugs already present** for idempotency.

### Operational scripts — `studio/`

- **`studio/candidates/<date>-batch.ts`** — Claude-authored candidate batches, as data (`Puzzle[]` with kebab `id`/slug, `name`, `size`, `rows`). Committed (reproducible, re-gradeable). This is the v1 "input"; a future designer is an alternate producer of the same shape.
- **`studio/preview.ts`** — reads a candidates file, grades each (so invalid ones can be shown), calls `buildGalleryHtml`, and writes `studio/preview/<date>.html` (gitignored). Prints the path.
- **`studio/publish.ts`** — reads a candidates file + approved IDs (CLI args), runs `planPublish` → upserts valid rows to `puzzles` via the admin client (slug-keyed, idempotent); with a schedule flag, runs `planSchedule` → appends to `daily_schedule`. Prints a summary (published, rejected-with-reason, scheduled positions).

`package.json` scripts mirror `seed`:
- `studio:preview` → `node --env-file=.env.local --import tsx studio/preview.ts <candidates-file>`
- `studio:publish` → `node --env-file=.env.local --import tsx studio/publish.ts <candidates-file> --ids a,b,c [--schedule]`

(The `--env-file` is only needed by `publish` for DB creds; `preview` is pure-local but uses the same runner for consistency.)

### The authoring loop

1. Michelle: "give me ~20 cozy 8×8s." → Claude writes `studio/candidates/<date>-batch.ts`.
2. Claude runs `studio:preview`, hands over the HTML path.
3. Michelle opens it, scans the renders, names the keepers.
4. Claude runs `studio:publish --ids …` (with `--schedule` to extend the daily runway). Puzzles go live; chosen ones append to the schedule.

Michelle touches the browser and a sentence of approval; Claude drives the terminal.

### Data behavior

- **Publish** writes `puzzles` rows with `status = 'published'` (into the pool). **Schedule** separately appends `daily_schedule` rows. A puzzle can be published without being scheduled.
- **Idempotency:** publish upserts on `slug` (re-running a batch is safe); schedule appends only slugs not already scheduled, at positions after the current max — never reorders existing positions (preserves daily past-stability).
- **Quality gate is non-negotiable:** a candidate that fails `gradeOrThrow` is never published; it surfaces in the gallery (and the publish summary) as rejected-with-reason.

---

## Testing (TDD)

All four pure pieces are directly unit-testable; the scripts stay thin shells over them.

- **`render.ts`** — rendered output contains the right filled/empty cell structure for a known small grid.
- **`gallery.ts`** — HTML contains each candidate's name, size, difficulty; invalid candidates appear with their rejection reason.
- **`planPublish`** — a unique line-solvable puzzle yields a row with the correct graded difficulty and `status: 'published'`; a non-unique / non-line-solvable puzzle lands in `rejected` with a reason and is absent from `valid`.
- **`planSchedule`** — appends after the current max position; skips slugs already in the schedule; preserves order; empty-schedule and all-already-scheduled edge cases.
- DB writes themselves are a thin shell over the tested planners (matching the seed/Daily pattern); no test depends on a live database.

The existing engine (`countSolutions`, `lineSolve`, `difficultyOf`, `gradeOrThrow`) is already exhaustively tested and is consumed as-is.

---

## Future doors (out of scope, recorded so they stay cheap)

- **Interactive designer** — a draw-on-grid surface for authoring "just for fun," especially at larger sizes. Slots in as another `Puzzle` producer feeding the same `render`/`plan`/publish modules. No rework of v1 needed.
- **Larger grids (25–30)** — wanted, but needs solver work first (the `countSolutions` node budget; `arrangements` enumeration cost at large `N`). Its own slice.
- **Color nonograms** — a different content model (multi-color cells, per-color clues). A substantial future slice; flagged early because Michelle wants it eventually and is (reasonably) wary of its complexity.
- **Community authoring** — the RLS `authenticated`-write policies already exist; a real login would activate them. Not this slice.
