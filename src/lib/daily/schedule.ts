import { DAILY_EPOCH, DAILY_LIST } from "./list";

// Parse "YYYY-MM-DD" to a UTC-noon timestamp. Noon avoids any DST/offset
// landing math on a different calendar day, so whole-day diffs are exact.
function toUtcNoon(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 12);
}

export function daysSince(epoch: string, date: string): number {
  return Math.round((toUtcNoon(date) - toUtcNoon(epoch)) / 86_400_000);
}

export type DailyResult =
  | { kind: "puzzle"; puzzleId: string; index: number }
  | { kind: "before-epoch" }
  | { kind: "none" };

export function dailyFor(
  date: string,
  list: readonly string[] = DAILY_LIST,
  epoch: string = DAILY_EPOCH,
): DailyResult {
  const index = daysSince(epoch, date);
  if (index < 0) return { kind: "before-epoch" };
  if (index >= list.length) return { kind: "none" };
  return { kind: "puzzle", puzzleId: list[index], index };
}
