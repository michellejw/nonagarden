import { describe, it, expect } from "vitest";
import { reducer, initState } from "./reducer";
import type { Puzzle } from "@/lib/nonogram";

const tee: Puzzle = { id: "t", name: "Tee", size: 3, rows: ["###", ".#.", ".#."] };
const other: Puzzle = { id: "o", name: "Oh", size: 3, rows: ["###", "#.#", "###"] };
const puzzles = [tee, other];

describe("reducer", () => {
  it("apply sets a cell and starts the clock", () => {
    const s0 = initState(puzzles);
    const s1 = reducer(s0, { type: "apply", r: 0, c: 0, value: 1, ts: 1000 });
    expect(s1.cells[0][0]).toBe(1);
    expect(s1.startTs).toBe(1000);
    expect(s1.won).toBe(false);
  });

  it("apply is a no-op when value is unchanged", () => {
    const s0 = initState(puzzles);
    const s1 = reducer(s0, { type: "apply", r: 0, c: 0, value: 0, ts: 1000 });
    expect(s1).toBe(s0);
  });

  it("detects a win and freezes elapsed", () => {
    let s = initState(puzzles);
    // solve the Tee: row0 all filled, row1 col1, row2 col1
    const fills: [number, number][] = [[0, 0], [0, 1], [0, 2], [1, 1], [2, 1]];
    let ts = 1000;
    for (const [r, c] of fills) s = reducer(s, { type: "apply", r, c, value: 1, ts: (ts += 1000) });
    expect(s.won).toBe(true);
    expect(s.frozenElapsed).toBe(s.startTs === null ? 0 : ts - s.startTs);
  });

  it("ignores input after win", () => {
    let s = initState(puzzles);
    const fills: [number, number][] = [[0, 0], [0, 1], [0, 2], [1, 1], [2, 1]];
    let ts = 1000;
    for (const [r, c] of fills) s = reducer(s, { type: "apply", r, c, value: 1, ts: (ts += 1000) });
    const after = reducer(s, { type: "apply", r: 1, c: 0, value: 1, ts: 99999 });
    expect(after).toBe(s);
  });

  it("reset clears the board, keeps the puzzle", () => {
    let s = initState(puzzles);
    s = reducer(s, { type: "apply", r: 0, c: 0, value: 1, ts: 1000 });
    s = reducer(s, { type: "reset" });
    expect(s.cells[0][0]).toBe(0);
    expect(s.startTs).toBeNull();
    expect(s.puzzle.id).toBe("t");
  });

  it("load swaps puzzle and resets board", () => {
    let s = initState(puzzles);
    s = reducer(s, { type: "load", index: 1, puzzle: other });
    expect(s.puzzle.id).toBe("o");
    expect(s.cells).toEqual([[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
  });
});
