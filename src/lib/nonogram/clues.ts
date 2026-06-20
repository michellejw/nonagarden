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
