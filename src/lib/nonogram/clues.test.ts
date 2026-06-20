import { describe, it, expect } from "vitest";
import { clueOf, solutionOf, cluesFor } from "./clues";
import type { Puzzle } from "./types";

describe("clueOf", () => {
  it("encodes run lengths", () => {
    expect(clueOf([true, true, false, true])).toEqual([2, 1]);
  });
  it("returns [0] for an empty line", () => {
    expect(clueOf([false, false])).toEqual([0]);
    expect(clueOf([])).toEqual([0]);
  });
  it("treats numeric 1 as filled", () => {
    expect(clueOf([1, 0, 1, 1])).toEqual([1, 2]);
  });
});

const tee: Puzzle = { id: "t", name: "Tee", size: 3, rows: ["###", ".#.", ".#."] };

describe("solutionOf / cluesFor", () => {
  it("maps rows to booleans", () => {
    expect(solutionOf(tee)[1]).toEqual([false, true, false]);
  });
  it("derives row and column clues", () => {
    const { rowClues, colClues } = cluesFor(tee);
    expect(rowClues).toEqual([[3], [1], [1]]);
    expect(colClues).toEqual([[1], [3], [1]]);
  });
});
