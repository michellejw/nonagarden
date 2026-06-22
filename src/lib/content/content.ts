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
