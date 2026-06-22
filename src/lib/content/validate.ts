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
    throw new Error(`Puzzle "${puzzle.id}" has no unique line-solution (not line-solvable)`);
  }

  const count = countSolutions(rowClues, colClues, puzzle.size, 2);
  if (!(count.status === "ok" && count.count === 1)) {
    throw new Error(`Puzzle "${puzzle.id}" does not have exactly one solution`);
  }

  return difficultyOf(rowClues, colClues, puzzle.size);
}
