import { describe, expect, it } from "vitest";
import { tryGrade } from "./grade";
import type { Puzzle } from "../nonogram";

const FULL_2x2: Puzzle = { id: "full", name: "Full", size: 2, rows: ["##", "##"] };
// Two filled cells on a diagonal: clues are ambiguous (2 solutions, not line-solvable).
const AMBIGUOUS_2x2: Puzzle = { id: "amb", name: "Amb", size: 2, rows: ["#.", ".#"] };

describe("tryGrade", () => {
  it("returns ok + difficulty for a unique line-solvable puzzle", () => {
    const r = tryGrade(FULL_2x2);
    expect(r).toEqual({ ok: true, difficulty: "forager" });
  });

  it("returns a reason instead of throwing for an invalid puzzle", () => {
    const r = tryGrade(AMBIGUOUS_2x2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/line-solvable|solution/);
  });
});
