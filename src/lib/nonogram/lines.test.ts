import { describe, it, expect } from "vitest";
import { lineSatisfied, lineFeasible, lineState } from "./lines";
import type { Cell } from "./types";

const C = (a: number[]) => a as Cell[];

describe("lineSatisfied", () => {
  it("matches exact runs", () => {
    expect(lineSatisfied(C([1, 1, 0, 1]), [2, 1])).toBe(true);
  });
  it("rejects wrong runs", () => {
    expect(lineSatisfied(C([1, 0, 1, 1]), [2, 1])).toBe(false);
  });
  it("treats marks(2) as empty", () => {
    expect(lineSatisfied(C([1, 2, 1, 1]), [1, 2])).toBe(true);
  });
  it("satisfies an empty clue with no fills", () => {
    expect(lineSatisfied(C([0, 2, 0]), [0])).toBe(true);
  });
});

describe("lineFeasible", () => {
  it("true when a clue can still be placed", () => {
    expect(lineFeasible(C([0, 0, 0, 0]), [2])).toBe(true);
  });
  it("false when a fill breaks the only placement", () => {
    // clue [3] in width 3 needs all filled; a known-empty(2) makes it impossible
    expect(lineFeasible(C([1, 2, 1]), [3])).toBe(false);
  });
  it("empty clue is infeasible once any cell is filled", () => {
    expect(lineFeasible(C([0, 1, 0]), [0])).toBe(false);
    expect(lineFeasible(C([0, 0, 0]), [0])).toBe(true);
  });
});

describe("lineState", () => {
  it("impossible takes precedence", () => {
    expect(lineState(C([1, 2, 1]), [3])).toBe("impossible");
  });
  it("satisfied when runs match", () => {
    expect(lineState(C([1, 1, 0]), [2])).toBe("satisfied");
  });
  it("won forces satisfied", () => {
    expect(lineState(C([0, 0, 0]), [1], true)).toBe("satisfied");
  });
  it("normal otherwise", () => {
    expect(lineState(C([0, 0, 0]), [1])).toBe("normal");
  });
});
