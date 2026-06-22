import { describe, it, expect } from "vitest";
import { gradeOrThrow } from "./validate";

describe("gradeOrThrow", () => {
  it("returns a difficulty for a valid, unique, line-solvable puzzle", () => {
    const sprout = {
      id: "sprout",
      name: "Sprout",
      size: 5,
      rows: ["..#..", "..#..", "#.#.#", ".###.", "..#.."],
    };
    expect(["forager", "woodlander", "mycologist"]).toContain(gradeOrThrow(sprout));
  });

  it("throws for a puzzle with more than one solution", () => {
    // 2x2 with one filled per row/col is satisfied by BOTH diagonals → not unique.
    const ambiguous = { id: "bad", name: "Bad", size: 2, rows: ["#.", ".#"] };
    expect(() => gradeOrThrow(ambiguous)).toThrow(/line-solvable/i);
  });
});
