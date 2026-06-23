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
