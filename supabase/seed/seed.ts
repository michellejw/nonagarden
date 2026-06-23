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
