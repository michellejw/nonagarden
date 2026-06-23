import { tryGrade } from "./grade";
import type { Difficulty, Puzzle } from "../nonogram";

export interface PublishRow {
  slug: string;
  name: string;
  size: number;
  rows: string[];
  difficulty: Difficulty;
  status: "published";
}

export interface RejectedCandidate {
  id: string;
  reason: string;
}

export interface PublishPlan {
  valid: PublishRow[];
  rejected: RejectedCandidate[];
}

/**
 * For each approved id (in order): find the candidate, grade it, and emit
 * either a publish row or a rejection. Unknown ids are rejected.
 */
export function planPublish(
  candidates: Puzzle[],
  approvedIds: string[],
): PublishPlan {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const valid: PublishRow[] = [];
  const rejected: RejectedCandidate[] = [];
  for (const id of approvedIds) {
    const c = byId.get(id);
    if (!c) {
      rejected.push({ id, reason: "candidate not found in batch" });
      continue;
    }
    const g = tryGrade(c);
    if (g.ok) {
      valid.push({
        slug: c.id,
        name: c.name,
        size: c.size,
        rows: c.rows,
        difficulty: g.difficulty,
        status: "published",
      });
    } else {
      rejected.push({ id, reason: g.reason });
    }
  }
  return { valid, rejected };
}

export interface ScheduleEntry {
  position: number;
  puzzleId: string;
}

/**
 * Compute the daily_schedule rows to APPEND: each new id placed at the next
 * position after the current max, in order, skipping ids already scheduled
 * (and de-duped within the input). Never reorders existing positions.
 */
export function planSchedule(
  newPuzzleIds: string[],
  existing: ScheduleEntry[],
): ScheduleEntry[] {
  const seen = new Set(existing.map((e) => e.puzzleId));
  let next = existing.reduce((m, e) => Math.max(m, e.position), -1) + 1;
  const out: ScheduleEntry[] = [];
  for (const id of newPuzzleIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ position: next++, puzzleId: id });
  }
  return out;
}
