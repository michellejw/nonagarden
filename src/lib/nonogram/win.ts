import type { Grid, Puzzle } from "./types";
import { cluesFor } from "./clues";
import { column } from "./grid";
import { lineSatisfied } from "./lines";

// Constraint-based: win iff every row AND column clue is satisfied.
// Never compares against the solution grid.
export function checkWin(cells: Grid, puzzle: Puzzle): boolean {
  const { rowClues, colClues } = cluesFor(puzzle);
  const N = puzzle.size;
  for (let i = 0; i < N; i++) if (!lineSatisfied(cells[i], rowClues[i])) return false;
  for (let j = 0; j < N; j++)
    if (!lineSatisfied(column(cells, j), colClues[j])) return false;
  return true;
}
