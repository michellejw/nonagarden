import { dailyFor } from "@/lib/daily";
import type { Puzzle } from "@/lib/nonogram";

export type ResolveResult =
  | { kind: "puzzle"; puzzle: Puzzle }
  | { kind: "today" } // play it on the front door instead
  | { kind: "future" }
  | { kind: "before-epoch" }
  | { kind: "gap" }
  | { kind: "not-found" };

// `today` is injected (the player's local date). `dailyFor` resolves against
// DAILY_EPOCH using the positional schedule, exactly as the Daily front door does.
export function dateToPuzzle(
  date: string,
  today: string,
  schedule: readonly string[],
  puzzles: readonly Puzzle[],
): ResolveResult {
  if (date === today) return { kind: "today" };
  const res = dailyFor(date, schedule);
  if (res.kind === "before-epoch") return { kind: "before-epoch" };
  if (date > today) return { kind: "future" };
  if (res.kind === "none") return { kind: "gap" };
  const id = res.puzzleId;
  if (!id) return { kind: "gap" };
  const puzzle = puzzles.find((p) => p.id === id);
  return puzzle ? { kind: "puzzle", puzzle } : { kind: "not-found" };
}
