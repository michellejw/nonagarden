import type { Puzzle } from "@/lib/nonogram";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createReadClient } from "./client";

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
