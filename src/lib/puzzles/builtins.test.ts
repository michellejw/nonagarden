import { describe, it, expect } from "vitest";
import { BUILTINS } from "./builtins";
import { cluesFor, countSolutions, lineSolve, difficultyOf } from "@/lib/nonogram";

describe("BUILTINS", () => {
  it("has at least 4 puzzles", () => {
    expect(BUILTINS.length).toBeGreaterThanOrEqual(4);
  });

  it("every puzzle is square and well-formed", () => {
    for (const p of BUILTINS) {
      expect(p.rows.length).toBe(p.size);
      for (const row of p.rows) {
        expect(row.length).toBe(p.size);
        expect(/^[#.]+$/.test(row)).toBe(true);
      }
    }
  });

  // PRIMARY GATE: solvable by pure line logic, no guessing (this also implies a unique solution).
  it("every puzzle is line-solvable without guessing", () => {
    for (const p of BUILTINS) {
      const { rowClues, colClues } = cluesFor(p);
      expect(
        lineSolve(rowClues, colClues, p.size).solved,
        `"${p.name}" must be solvable by logic alone (no guessing)`,
      ).toBe(true);
    }
  });

  // CROSS-CHECK: independent backtracking count agrees there is exactly one solution.
  it("every puzzle has exactly one solution", () => {
    for (const p of BUILTINS) {
      const { rowClues, colClues } = cluesFor(p);
      expect(
        countSolutions(rowClues, colClues, p.size, 2),
        `"${p.name}" should be uniquely solvable`,
      ).toEqual({ status: "ok", count: 1 });
    }
  });

  // Difficulty grades to a real tier (never undefined); built-ins should not be mycologist.
  it("every puzzle grades to forager or woodlander", () => {
    for (const p of BUILTINS) {
      const { rowClues, colClues } = cluesFor(p);
      expect(
        ["forager", "woodlander"],
        `"${p.name}" graded too hard for a built-in`,
      ).toContain(difficultyOf(rowClues, colClues, p.size));
    }
  });

  it("has unique ids", () => {
    const ids = BUILTINS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
