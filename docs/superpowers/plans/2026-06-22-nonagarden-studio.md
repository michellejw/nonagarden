# Nonagarden Studio v1 — Batch Authoring Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local, no-auth pipeline that takes a batch of candidate puzzles → grades them through the engine → renders a static HTML review gallery → publishes the approved ones to Supabase and optionally appends them to the daily schedule.

**Architecture:** Four pure, unit-tested modules in `src/lib/studio/` (grade, render, gallery, plan) do all real work; two thin `tsx` scripts in `studio/` (preview, publish) wire them to the filesystem and the existing secret-key admin client. Generation is done by Claude (committed candidate data files); validation is the existing engine (`gradeOrThrow`); curation is the human via the gallery.

**Tech Stack:** TypeScript, Vitest, `tsx` runner, `@supabase/supabase-js` admin client (already present). No new dependencies.

## Global Constraints

- **No new dependencies.** Reuse `gradeOrThrow` (`src/lib/content/validate.ts`), `createAdminClient` (`src/lib/content/client.ts`), and the engine via `src/lib/nonogram`. No `@supabase/ssr`, no auth.
- **Relative imports only in all `studio` code** (both `src/lib/studio/*` and `studio/*`). Use `../nonogram`, `../content/validate`, etc. — NOT the `@/` alias. The `tsx`-run scripts do not resolve tsconfig `paths`; this matches `supabase/seed/seed.ts`.
- **Tests live under `src/`** (vitest `include` is `src/**/*.{test,spec}.{ts,tsx}`). The `studio/` scripts are thin shells verified by run-and-inspect, not vitest.
- **Publish ≠ schedule.** Publishing sets `status: 'published'` (pool). Scheduling separately appends to `daily_schedule`. A puzzle can be published without being scheduled.
- **Studio puzzles carry a kebab `slug` = the candidate's `id`.** Publish upserts on `slug` (idempotent). The schedule is **append-only** — `planSchedule` only adds positions after the current max and never reorders existing ones (preserves daily past-stability).
- **The engine is the gate.** A candidate failing `gradeOrThrow` is never published; it surfaces as rejected-with-reason.
- **Do NOT run the real (non-`--dry-run`) publish during plan execution.** It writes to the shared live Supabase. All verification in this plan uses `--dry-run` (fully offline). The real publish is Michelle's call.
- **Sizes stay small** (≤ ~15), as today.
- Conventional-commit messages; commit at the end of each task.
- Run tests with `pnpm test:run`; typecheck with `pnpm typecheck`.

---

### Task 1: `tryGrade` — non-throwing engine gate

**Files:**
- Create: `src/lib/studio/grade.ts`
- Test: `src/lib/studio/grade.test.ts`

**Interfaces:**
- Consumes: `gradeOrThrow(puzzle): Difficulty` from `../content/validate`; `Puzzle`, `Difficulty` types from `../nonogram`.
- Produces: `type GradeResult = { ok: true; difficulty: Difficulty } | { ok: false; reason: string }`; `tryGrade(puzzle: Puzzle): GradeResult`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/studio/grade.test.ts
import { describe, expect, it } from "vitest";
import { tryGrade } from "./grade";
import type { Puzzle } from "../nonogram";

const FULL_2x2: Puzzle = { id: "full", name: "Full", size: 2, rows: ["##", "##"] };
// Two filled cells on a diagonal: clues are ambiguous (2 solutions, not line-solvable).
const AMBIGUOUS_2x2: Puzzle = { id: "amb", name: "Amb", size: 2, rows: ["#.", ".#"] };

describe("tryGrade", () => {
  it("returns ok + difficulty for a unique line-solvable puzzle", () => {
    const r = tryGrade(FULL_2x2);
    expect(r).toEqual({ ok: true, difficulty: "forager" });
  });

  it("returns a reason instead of throwing for an invalid puzzle", () => {
    const r = tryGrade(AMBIGUOUS_2x2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/line-solvable|solution/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/lib/studio/grade.test.ts`
Expected: FAIL — cannot resolve `./grade` / `tryGrade` is not a function.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/studio/grade.ts
import { gradeOrThrow } from "../content/validate";
import type { Difficulty, Puzzle } from "../nonogram";

export type GradeResult =
  | { ok: true; difficulty: Difficulty }
  | { ok: false; reason: string };

/** Run the engine quality gate without throwing. */
export function tryGrade(puzzle: Puzzle): GradeResult {
  try {
    return { ok: true, difficulty: gradeOrThrow(puzzle) };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/lib/studio/grade.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/studio/grade.ts src/lib/studio/grade.test.ts
git commit -m "feat: add tryGrade non-throwing engine gate for Studio"
```

---

### Task 2: `renderGridHtml` — solution grid → HTML fragment

**Files:**
- Create: `src/lib/studio/render.ts`
- Test: `src/lib/studio/render.test.ts`

**Interfaces:**
- Consumes: `Puzzle` from `../nonogram`.
- Produces: `renderGridHtml(puzzle: Puzzle): string` — a single `<div class="sg-grid" style="grid-template-columns:repeat(N,1fr)">` containing `size*size` `<span class="sg-cell filled|empty">` children; `#` → `filled`, else `empty`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/studio/render.test.ts
import { describe, expect, it } from "vitest";
import { renderGridHtml } from "./render";
import type { Puzzle } from "../nonogram";

const P: Puzzle = { id: "p", name: "P", size: 2, rows: ["#.", ".#"] };

const count = (s: string, sub: string) => s.split(sub).length - 1;

describe("renderGridHtml", () => {
  it("emits a grid sized to the puzzle", () => {
    expect(renderGridHtml(P)).toContain("repeat(2,1fr)");
  });

  it("emits one cell per square with filled/empty matching '#'", () => {
    const html = renderGridHtml(P);
    expect(count(html, "sg-cell")).toBe(4);
    expect(count(html, "sg-cell filled")).toBe(2);
    expect(count(html, "sg-cell empty")).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/lib/studio/render.test.ts`
Expected: FAIL — cannot resolve `./render`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/studio/render.ts
import type { Puzzle } from "../nonogram";

/**
 * Render a puzzle's solution grid as a self-contained HTML fragment:
 * a CSS-grid <div> with size×size cell <span>s. '#' → filled, else empty.
 * Pure; no engine calls.
 */
export function renderGridHtml(puzzle: Puzzle): string {
  const cells = puzzle.rows
    .map((row) =>
      row
        .split("")
        .map(
          (ch) =>
            `<span class="sg-cell ${ch === "#" ? "filled" : "empty"}"></span>`,
        )
        .join(""),
    )
    .join("");
  return `<div class="sg-grid" style="grid-template-columns:repeat(${puzzle.size},1fr)">${cells}</div>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/lib/studio/render.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/studio/render.ts src/lib/studio/render.test.ts
git commit -m "feat: add renderGridHtml for Studio gallery"
```

---

### Task 3: `gallery` — grade candidates + build review HTML page

**Files:**
- Create: `src/lib/studio/gallery.ts`
- Test: `src/lib/studio/gallery.test.ts`

**Interfaces:**
- Consumes: `tryGrade` from `./grade`; `renderGridHtml` from `./render`; `Puzzle`, `Difficulty` from `../nonogram`.
- Produces:
  - `interface GalleryItem { puzzle: Puzzle; valid: boolean; difficulty?: Difficulty; reason?: string }`
  - `gradeCandidates(candidates: Puzzle[]): GalleryItem[]` — grades every candidate (never throws).
  - `buildGalleryHtml(items: GalleryItem[], title?: string): string` — a complete self-contained HTML document.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/studio/gallery.test.ts
import { describe, expect, it } from "vitest";
import { buildGalleryHtml, gradeCandidates } from "./gallery";
import type { Puzzle } from "../nonogram";

const FULL: Puzzle = { id: "full", name: "Full", size: 2, rows: ["##", "##"] };
const AMB: Puzzle = { id: "amb", name: "Amb", size: 2, rows: ["#.", ".#"] };

describe("gradeCandidates", () => {
  it("marks valid and invalid candidates with difficulty/reason", () => {
    const items = gradeCandidates([FULL, AMB]);
    expect(items[0]).toMatchObject({ valid: true, difficulty: "forager" });
    expect(items[1].valid).toBe(false);
    expect(items[1].reason).toBeTruthy();
  });
});

describe("buildGalleryHtml", () => {
  it("renders a full document with names, difficulty, validity count, and rejection reasons", () => {
    const html = buildGalleryHtml(gradeCandidates([FULL, AMB]));
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Full");
    expect(html).toContain("forager");
    expect(html).toContain("1/2 valid");
    expect(html).toContain("invalid");
    expect(html).toMatch(/line-solvable|solution/); // the rejection reason for AMB
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/lib/studio/gallery.test.ts`
Expected: FAIL — cannot resolve `./gallery`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/studio/gallery.ts
import { tryGrade } from "./grade";
import { renderGridHtml } from "./render";
import type { Difficulty, Puzzle } from "../nonogram";

export interface GalleryItem {
  puzzle: Puzzle;
  valid: boolean;
  difficulty?: Difficulty;
  reason?: string;
}

/** Grade every candidate (never throws) into reviewable gallery items. */
export function gradeCandidates(candidates: Puzzle[]): GalleryItem[] {
  return candidates.map((puzzle) => {
    const g = tryGrade(puzzle);
    return g.ok
      ? { puzzle, valid: true, difficulty: g.difficulty }
      : { puzzle, valid: false, reason: g.reason };
  });
}

const STYLE = `
  body { font-family: ui-rounded, "Fredoka", system-ui, sans-serif; background: #faf7f0; color: #2c2a26; margin: 2rem; }
  h1 { font-size: 1.4rem; }
  .gallery { display: flex; flex-wrap: wrap; gap: 1.25rem; }
  .card { background: #fff; border: 1px solid #e7e0d4; border-radius: 14px; padding: 0.9rem; width: max-content; }
  .card.is-invalid { border-color: #d8a39a; background: #fdf3f1; }
  .sg-grid { display: inline-grid; gap: 1px; background: #cfc6b6; border: 1px solid #cfc6b6; }
  .sg-cell { width: 18px; height: 18px; }
  .sg-cell.filled { background: #4a4540; }
  .sg-cell.empty { background: #f4efe6; }
  figcaption { margin-top: 0.5rem; font-size: 0.85rem; }
  .badge { display: inline-block; margin-left: 0.35rem; padding: 0.05rem 0.4rem; border-radius: 999px; font-size: 0.72rem; background: #ece4d6; }
  .badge.invalid { background: #d8a39a; color: #fff; }
  .reason { margin: 0.35rem 0 0; font-size: 0.78rem; color: #9c5a4d; }
`;

export function buildGalleryHtml(
  items: GalleryItem[],
  title = "Nonagarden — candidates",
): string {
  const validCount = items.filter((i) => i.valid).length;
  const cards = items
    .map((it) => {
      const badge = it.valid
        ? `<span class="badge ${it.difficulty}">${it.difficulty}</span>`
        : `<span class="badge invalid">invalid</span>`;
      const note = it.valid ? "" : `<p class="reason">${it.reason}</p>`;
      return `<figure class="card ${it.valid ? "" : "is-invalid"}">
  ${renderGridHtml(it.puzzle)}
  <figcaption><strong>${it.puzzle.name}</strong> · ${it.puzzle.size}×${it.puzzle.size} · <code>${it.puzzle.id}</code> ${badge}${note}</figcaption>
</figure>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${title}</title><style>${STYLE}</style></head>
<body>
<h1>${title}</h1>
<p>${validCount}/${items.length} valid</p>
<main class="gallery">${cards}</main>
</body>
</html>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/lib/studio/gallery.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/studio/gallery.ts src/lib/studio/gallery.test.ts
git commit -m "feat: add Studio review gallery (grade + buildGalleryHtml)"
```

---

### Task 4: `plan` — publish & schedule planners

**Files:**
- Create: `src/lib/studio/plan.ts`
- Test: `src/lib/studio/plan.test.ts`

**Interfaces:**
- Consumes: `tryGrade` from `./grade`; `Puzzle`, `Difficulty` from `../nonogram`.
- Produces:
  - `interface PublishRow { slug: string; name: string; size: number; rows: string[]; difficulty: Difficulty; status: "published" }`
  - `interface RejectedCandidate { id: string; reason: string }`
  - `interface PublishPlan { valid: PublishRow[]; rejected: RejectedCandidate[] }`
  - `planPublish(candidates: Puzzle[], approvedIds: string[]): PublishPlan`
  - `interface ScheduleEntry { position: number; puzzleId: string }`
  - `planSchedule(newPuzzleIds: string[], existing: ScheduleEntry[]): ScheduleEntry[]` — rows to APPEND.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/studio/plan.test.ts
import { describe, expect, it } from "vitest";
import { planPublish, planSchedule } from "./plan";
import type { Puzzle } from "../nonogram";

const FULL: Puzzle = { id: "full", name: "Full", size: 2, rows: ["##", "##"] };
const AMB: Puzzle = { id: "amb", name: "Amb", size: 2, rows: ["#.", ".#"] };

describe("planPublish", () => {
  it("produces a published row for a valid approved candidate", () => {
    const plan = planPublish([FULL, AMB], ["full"]);
    expect(plan.valid).toEqual([
      { slug: "full", name: "Full", size: 2, rows: ["##", "##"], difficulty: "forager", status: "published" },
    ]);
    expect(plan.rejected).toEqual([]);
  });

  it("rejects invalid candidates and unknown ids, preserving order", () => {
    const plan = planPublish([FULL, AMB], ["amb", "ghost"]);
    expect(plan.valid).toEqual([]);
    expect(plan.rejected.map((r) => r.id)).toEqual(["amb", "ghost"]);
    expect(plan.rejected[0].reason).toMatch(/line-solvable|solution/);
    expect(plan.rejected[1].reason).toMatch(/not found/);
  });
});

describe("planSchedule", () => {
  it("appends new ids after the current max position", () => {
    const existing = [
      { position: 0, puzzleId: "a" },
      { position: 1, puzzleId: "b" },
    ];
    expect(planSchedule(["b", "c", "d", "c"], existing)).toEqual([
      { position: 2, puzzleId: "c" },
      { position: 3, puzzleId: "d" },
    ]);
  });

  it("starts at 0 for an empty schedule", () => {
    expect(planSchedule(["x", "y"], [])).toEqual([
      { position: 0, puzzleId: "x" },
      { position: 1, puzzleId: "y" },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run src/lib/studio/plan.test.ts`
Expected: FAIL — cannot resolve `./plan`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/studio/plan.ts
import { tryGrade } from "./grade";
import type { Difficulty, Puzzle } from "../nonogram";

export interface PublishRow {
  slug: string;
  name: string;
  size: number;
  rows: string[];
  difficulty: Difficulty;
  status: "published";
}

export interface RejectedCandidate {
  id: string;
  reason: string;
}

export interface PublishPlan {
  valid: PublishRow[];
  rejected: RejectedCandidate[];
}

/**
 * For each approved id (in order): find the candidate, grade it, and emit
 * either a publish row or a rejection. Unknown ids are rejected.
 */
export function planPublish(
  candidates: Puzzle[],
  approvedIds: string[],
): PublishPlan {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const valid: PublishRow[] = [];
  const rejected: RejectedCandidate[] = [];
  for (const id of approvedIds) {
    const c = byId.get(id);
    if (!c) {
      rejected.push({ id, reason: "candidate not found in batch" });
      continue;
    }
    const g = tryGrade(c);
    if (g.ok) {
      valid.push({
        slug: c.id,
        name: c.name,
        size: c.size,
        rows: c.rows,
        difficulty: g.difficulty,
        status: "published",
      });
    } else {
      rejected.push({ id, reason: g.reason });
    }
  }
  return { valid, rejected };
}

export interface ScheduleEntry {
  position: number;
  puzzleId: string;
}

/**
 * Compute the daily_schedule rows to APPEND: each new id placed at the next
 * position after the current max, in order, skipping ids already scheduled
 * (and de-duped within the input). Never reorders existing positions.
 */
export function planSchedule(
  newPuzzleIds: string[],
  existing: ScheduleEntry[],
): ScheduleEntry[] {
  const seen = new Set(existing.map((e) => e.puzzleId));
  let next = existing.reduce((m, e) => Math.max(m, e.position), -1) + 1;
  const out: ScheduleEntry[] = [];
  for (const id of newPuzzleIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ position: next++, puzzleId: id });
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run src/lib/studio/plan.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/studio/plan.ts src/lib/studio/plan.test.ts
git commit -m "feat: add Studio publish + schedule planners"
```

---

### Task 5: Candidate batch + `preview` script + gitignore + pnpm script

**Files:**
- Create: `studio/candidates/2026-06-22-starter.ts`
- Create: `studio/preview.ts`
- Modify: `.gitignore` (add `/studio/preview/`)
- Modify: `package.json` (add `studio:preview` script)

**Interfaces:**
- Consumes: `buildGalleryHtml`, `gradeCandidates` from `../src/lib/studio/gallery`; `Puzzle` from `../src/lib/nonogram`.
- Produces: a runnable `pnpm studio:preview <candidates-file>` that writes `studio/preview/<basename>.html`. The candidate file exports `const candidates: Puzzle[]`.

- [ ] **Step 1: Create the starter candidate batch** (the 8 spike puzzles — all known valid)

```ts
// studio/candidates/2026-06-22-starter.ts
import type { Puzzle } from "../../src/lib/nonogram";

export const candidates: Puzzle[] = [
  { id: "heart", name: "Heart", size: 7, rows: [".##.##.", "#######", "#######", "#######", ".#####.", "..###..", "...#..."] },
  { id: "mushroom", name: "Mushroom", size: 8, rows: ["..####..", ".######.", "########", "########", "...##...", "...##...", "..####..", "..####.."] },
  { id: "tree", name: "Tree", size: 7, rows: ["...#...", "..###..", ".#####.", "#######", "...#...", "...#...", "..###.."] },
  { id: "house", name: "House", size: 8, rows: ["...##...", "..####..", ".######.", "########", "########", "##.##.##", "##.##.##", "########"] },
  { id: "cat", name: "Cat", size: 8, rows: ["##....##", "###..###", "########", "########", "#.####.#", "########", "###..###", "##....##"] },
  { id: "apple", name: "Apple", size: 7, rows: ["...#...", ".##.##.", "#######", "#######", "#######", ".#####.", "..#.#.."] },
  { id: "diamond", name: "Diamond", size: 7, rows: ["...#...", "..###..", ".#####.", "#######", ".#####.", "..###..", "...#..."] },
  { id: "sailboat", name: "Sailboat", size: 8, rows: ["....#...", "....##..", "....###.", "....####", "....#...", "........", "########", ".######."] },
];
```

- [ ] **Step 2: Create the preview script**

```ts
// studio/preview.ts
import { mkdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildGalleryHtml, gradeCandidates } from "../src/lib/studio/gallery";
import type { Puzzle } from "../src/lib/nonogram";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("usage: studio:preview <candidates-file>");
  const mod = (await import(pathToFileURL(resolve(file)).href)) as {
    candidates: Puzzle[];
  };
  const items = gradeCandidates(mod.candidates);
  const html = buildGalleryHtml(items);
  await mkdir("studio/preview", { recursive: true });
  const out = `studio/preview/${basename(file).replace(/\.ts$/, "")}.html`;
  await writeFile(out, html, "utf8");
  console.log(
    `Wrote ${items.filter((i) => i.valid).length}/${items.length} valid → ${out}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 3: Add the gitignore entry**

Add this line under the `# editors / local tooling` section of `.gitignore` (the generated galleries are throwaway):

```
/studio/preview/
```

- [ ] **Step 4: Add the pnpm script**

In `package.json`, add to `"scripts"` (after `"seed"`):

```json
    "studio:preview": "node --import tsx studio/preview.ts",
```

- [ ] **Step 5: Run the preview end-to-end**

Run: `pnpm studio:preview studio/candidates/2026-06-22-starter.ts`
Expected stdout: `Wrote 8/8 valid → studio/preview/2026-06-22-starter.html`
Then confirm the file exists and is non-empty:
Run: `test -s studio/preview/2026-06-22-starter.html && echo OK`
Expected: `OK`

- [ ] **Step 6: Verify typecheck still passes**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 7: Commit** (the generated HTML is gitignored, so it won't be added)

```bash
git add studio/candidates/2026-06-22-starter.ts studio/preview.ts .gitignore package.json
git commit -m "feat: add Studio candidate batch + preview gallery script"
```

---

### Task 6: `publish` script (with offline `--dry-run`) + pnpm script

**Files:**
- Create: `studio/publish.ts`
- Modify: `package.json` (add `studio:publish` script)

**Interfaces:**
- Consumes: `createAdminClient` from `../src/lib/content/client`; `planPublish`, `planSchedule`, `ScheduleEntry` from `../src/lib/studio/plan`; `Puzzle` from `../src/lib/nonogram`.
- Produces: `pnpm studio:publish <file> --ids a,b,c [--schedule] [--dry-run]`. `--dry-run` prints the publish plan and (with `--schedule`) the slugs that would be appended, touching no database.

- [ ] **Step 1: Create the publish script**

```ts
// studio/publish.ts
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createAdminClient } from "../src/lib/content/client";
import { planPublish, planSchedule, type ScheduleEntry } from "../src/lib/studio/plan";
import type { Puzzle } from "../src/lib/nonogram";

function parseArgs(argv: string[]) {
  const file = argv[2];
  let ids: string[] = [];
  let schedule = false;
  let dryRun = false;
  for (let i = 3; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--schedule") schedule = true;
    else if (a === "--dry-run") dryRun = true;
    else if (a === "--ids")
      ids = (argv[++i] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  }
  return { file, ids, schedule, dryRun };
}

async function main() {
  const { file, ids, schedule, dryRun } = parseArgs(process.argv);
  if (!file || ids.length === 0)
    throw new Error(
      "usage: studio:publish <file> --ids a,b,c [--schedule] [--dry-run]",
    );

  const mod = (await import(pathToFileURL(resolve(file)).href)) as {
    candidates: Puzzle[];
  };
  const plan = planPublish(mod.candidates, ids);

  console.log(
    `Publish plan: ${plan.valid.length} valid, ${plan.rejected.length} rejected`,
  );
  for (const r of plan.valid) console.log(`  ✔ ${r.slug} (${r.difficulty})`);
  for (const r of plan.rejected) console.log(`  ✗ ${r.id} — ${r.reason}`);

  if (dryRun) {
    if (schedule)
      console.log(
        `Would schedule (append): ${plan.valid.map((r) => r.slug).join(", ") || "(none)"}`,
      );
    console.log("Dry run — no writes.");
    return;
  }

  if (plan.valid.length === 0) {
    console.log("Nothing to publish.");
    return;
  }

  const sb = createAdminClient();
  const { error: upErr } = await sb.from("puzzles").upsert(
    plan.valid.map((r) => ({
      slug: r.slug,
      name: r.name,
      size: r.size,
      rows: r.rows,
      difficulty: r.difficulty,
      status: r.status,
    })),
    { onConflict: "slug" },
  );
  if (upErr) throw upErr;
  console.log(`Published ${plan.valid.length} puzzles.`);

  if (schedule) {
    const slugs = plan.valid.map((r) => r.slug);
    const { data: pz, error: pzErr } = await sb
      .from("puzzles")
      .select("id,slug")
      .in("slug", slugs);
    if (pzErr) throw pzErr;
    const idBySlug = new Map(
      (pz ?? []).map((p) => [p.slug as string, p.id as string]),
    );
    const newIds = slugs
      .map((s) => idBySlug.get(s))
      .filter((x): x is string => Boolean(x));

    const { data: sched, error: schErr } = await sb
      .from("daily_schedule")
      .select("position,puzzle_id");
    if (schErr) throw schErr;
    const existing: ScheduleEntry[] = (sched ?? []).map((s) => ({
      position: s.position as number,
      puzzleId: s.puzzle_id as string,
    }));

    const toAppend = planSchedule(newIds, existing);
    if (toAppend.length === 0) {
      console.log("Schedule already up to date.");
      return;
    }
    const { error: insErr } = await sb.from("daily_schedule").upsert(
      toAppend.map((e) => ({ position: e.position, puzzle_id: e.puzzleId })),
      { onConflict: "position" },
    );
    if (insErr) throw insErr;
    console.log(
      `Scheduled ${toAppend.length} at positions ${toAppend[0].position}..${toAppend[toAppend.length - 1].position}.`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Add the pnpm script**

In `package.json`, add to `"scripts"` (after `"studio:preview"`):

```json
    "studio:publish": "node --env-file=.env.local --import tsx studio/publish.ts",
```

- [ ] **Step 3: Verify the dry-run end-to-end (NO database writes)**

Run: `pnpm studio:publish studio/candidates/2026-06-22-starter.ts --ids heart,tree,ghost --schedule --dry-run`
Expected stdout (order matters for the valid/rejected lines):
```
Publish plan: 2 valid, 1 rejected
  ✔ heart (woodlander)
  ✔ tree (woodlander)
  ✗ ghost — candidate not found in batch
Would schedule (append): heart, tree
Dry run — no writes.
```

- [ ] **Step 4: Verify typecheck and the full test suite**

Run: `pnpm typecheck && pnpm test:run`
Expected: typecheck clean; all tests pass (existing suite + the 10 new Studio tests).

- [ ] **Step 5: Commit**

```bash
git add studio/publish.ts package.json
git commit -m "feat: add Studio publish script with offline dry-run"
```

---

## Self-Review

**Spec coverage:**
- Local no-auth pipeline → Tasks 5–6 (admin client, no login). ✓
- Engine as quality gate (`gradeOrThrow`) → Task 1 (`tryGrade`), used by Tasks 3–4. ✓
- HTML gallery rendering real grids + difficulty + invalid-with-reason → Tasks 2–3. ✓
- Publish ≠ schedule (pool vs runway) → Task 4 planners + Task 6 `--schedule` flag. ✓
- Idempotent, append-only, never-reorder → `planSchedule` (Task 4) + slug upsert (Task 6). ✓
- Pure + unit-tested, thin script shells → Tasks 1–4 tested; 5–6 run-verified. ✓
- Designer-ready (modules consume `Puzzle[]`) → all modules take plain puzzles. ✓
- Relative-imports constraint → applied in every studio file. ✓
- No new deps → only existing engine/client reused. ✓

**Placeholder scan:** none — every step has full code or an exact command + expected output.

**Type consistency:** `GradeResult`/`tryGrade` (Task 1) consumed unchanged by Tasks 3–4; `GalleryItem` (Task 3) consumed by Task 5; `PublishRow`/`PublishPlan`/`ScheduleEntry`/`planPublish`/`planSchedule` (Task 4) consumed by Task 6 with matching signatures; candidate files export `const candidates: Puzzle[]` consumed identically by preview (Task 5) and publish (Task 6). Difficulty values used in tests (`forager`, `woodlander`) match the engine's `Difficulty` union.
