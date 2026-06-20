import { describe, it, expect } from "vitest";
import { arrangements, countSolutions, lineSolve, difficultyOf } from "./solve";
import { cluesFor } from "./clues";
import type { Puzzle } from "./types";

describe("arrangements", () => {
  it("enumerates placements of a single block", () => {
    // clue [1] in width 3 → three positions
    expect(arrangements([1], 3)).toEqual([
      [1, 2, 2],
      [2, 1, 2],
      [2, 2, 1],
    ]);
  });
  it("a full line has exactly one arrangement", () => {
    expect(arrangements([3], 3)).toEqual([[1, 1, 1]]);
  });
  it("empty clue → all empty", () => {
    expect(arrangements([0], 3)).toEqual([[2, 2, 2]]);
  });
});

describe("countSolutions", () => {
  it("reports a unique solution", () => {
    const tee: Puzzle = { id: "t", name: "Tee", size: 3, rows: ["###", ".#.", ".#."] };
    const { rowClues, colClues } = cluesFor(tee);
    expect(countSolutions(rowClues, colClues, 3, 2)).toEqual({ status: "ok", count: 1 });
  });
  it("detects multiple solutions", () => {
    // a 2×2 checkerboard clue set has two solutions
    const rowClues = [[1], [1]];
    const colClues = [[1], [1]];
    const res = countSolutions(rowClues, colClues, 2, 2);
    expect(res).toEqual({ status: "ok", count: 2 });
  });
});

describe("lineSolve", () => {
  it("fully solves a line-solvable puzzle by logic alone", () => {
    const tee: Puzzle = { id: "t", name: "Tee", size: 3, rows: ["###", ".#.", ".#."] };
    const { rowClues, colClues } = cluesFor(tee);
    expect(lineSolve(rowClues, colClues, 3).solved).toBe(true);
  });
  it("reports unsolved when a clue set requires guessing", () => {
    // 2×2 with [1]/[1] rows & cols: two solutions, line logic forces nothing
    expect(lineSolve([[1], [1]], [[1], [1]], 2).solved).toBe(false);
  });
});

describe("difficultyOf", () => {
  it("grades a simple line-solvable puzzle below mycologist", () => {
    const tee: Puzzle = { id: "t", name: "Tee", size: 3, rows: ["###", ".#.", ".#."] };
    const { rowClues, colClues } = cluesFor(tee);
    expect(["forager", "woodlander"]).toContain(difficultyOf(rowClues, colClues, 3));
  });
  it("labels a guess-requiring set as mycologist", () => {
    expect(difficultyOf([[1], [1]], [[1], [1]], 2)).toBe("mycologist");
  });
});
