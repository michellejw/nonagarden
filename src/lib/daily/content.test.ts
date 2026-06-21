import { describe, it, expect } from "vitest";
import { DAILY_LIST } from "./list";
import { BUILTINS } from "@/lib/puzzles/builtins";
import { cluesFor, lineSolve, countSolutions, difficultyOf } from "@/lib/nonogram";

const byId = new Map(BUILTINS.map((p) => [p.id, p]));

describe("daily content integrity", () => {
  it("has at least 14 days of runway", () => {
    expect(DAILY_LIST.length).toBeGreaterThanOrEqual(14);
  });

  it("references only real puzzles, with no duplicate ids in the schedule", () => {
    for (const id of DAILY_LIST) expect(byId.has(id)).toBe(true);
    expect(new Set(DAILY_LIST).size).toBe(DAILY_LIST.length);
  });

  it("every scheduled puzzle is unique and line-solvable (no guessing)", () => {
    for (const id of DAILY_LIST) {
      const p = byId.get(id)!;
      const { rowClues, colClues } = cluesFor(p);
      const solved = lineSolve(rowClues, colClues, p.size);
      expect(solved.solved, `${id} must be line-solvable`).toBe(true);
      const count = countSolutions(rowClues, colClues, p.size, 2);
      expect(count, `${id} must have exactly one solution`).toEqual({ status: "ok", count: 1 });
    }
  });

  it("grades every scheduled puzzle (forager/woodlander/mycologist)", () => {
    for (const id of DAILY_LIST) {
      const p = byId.get(id)!;
      const { rowClues, colClues } = cluesFor(p);
      expect(["forager", "woodlander", "mycologist"]).toContain(
        difficultyOf(rowClues, colClues, p.size),
      );
    }
  });
});
