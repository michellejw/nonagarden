import { describe, it, expect } from "vitest";
import { checkWin } from "./win";
import { solutionOf } from "./clues";
import type { Cell, Grid, Puzzle } from "./types";

const tee: Puzzle = { id: "t", name: "Tee", size: 3, rows: ["###", ".#.", ".#."] };

function solvedGrid(p: Puzzle): Grid {
  return solutionOf(p).map((row) => row.map((b) => (b ? 1 : 0) as Cell));
}

describe("checkWin", () => {
  it("true for the solved board", () => {
    expect(checkWin(solvedGrid(tee), tee)).toBe(true);
  });
  it("marks(2) count as empty, not filled", () => {
    const g = solvedGrid(tee);
    // turn the empties into explicit marks — still a win
    const marked: Grid = g.map((row) => row.map((v) => (v === 0 ? 2 : 1)) as Cell[]);
    expect(checkWin(marked, tee)).toBe(true);
  });
  it("false for an incomplete board", () => {
    const g = solvedGrid(tee);
    g[0][0] = 0;
    expect(checkWin(g, tee)).toBe(false);
  });
});
