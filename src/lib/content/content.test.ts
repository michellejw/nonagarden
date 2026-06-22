import { describe, it, expect } from "vitest";
import { mapContent } from "./content";

describe("mapContent", () => {
  it("maps puzzle rows to the Puzzle shape (dropping extra columns)", () => {
    const { puzzles } = mapContent(
      [{ id: "a", name: "Acorn", size: 5, rows: ["#####"] }],
      [],
    );
    expect(puzzles).toEqual([{ id: "a", name: "Acorn", size: 5, rows: ["#####"] }]);
  });

  it("orders the schedule by position regardless of input row order", () => {
    const { schedule } = mapContent(
      [],
      [
        { position: 2, puzzle_id: "c" },
        { position: 0, puzzle_id: "a" },
        { position: 1, puzzle_id: "b" },
      ],
    );
    expect(schedule).toEqual(["a", "b", "c"]);
  });

  it("fills positional holes with '' so indices stay aligned (never compacts)", () => {
    const { schedule } = mapContent(
      [],
      [
        { position: 0, puzzle_id: "a" },
        { position: 2, puzzle_id: "c" },
      ],
    );
    expect(schedule).toEqual(["a", "", "c"]);
  });

  it("returns empty content for empty inputs", () => {
    expect(mapContent([], [])).toEqual({ puzzles: [], schedule: [] });
  });
});
