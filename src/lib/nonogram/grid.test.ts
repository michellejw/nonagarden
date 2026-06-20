import { describe, it, expect } from "vitest";
import { emptyGrid, column } from "./grid";

describe("emptyGrid", () => {
  it("makes an N×N grid of zeros", () => {
    expect(emptyGrid(3)).toEqual([
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
  });
  it("does not share row references", () => {
    const g = emptyGrid(2);
    g[0][0] = 1;
    expect(g[1][0]).toBe(0);
  });
});

describe("column", () => {
  it("extracts a column", () => {
    expect(column([[1, 2], [3, 4]], 1)).toEqual([2, 4]);
  });
});
