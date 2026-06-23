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
        `Would schedule (append, minus already-scheduled): ${plan.valid.map((r) => r.slug).join(", ") || "(none)"}`,
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
