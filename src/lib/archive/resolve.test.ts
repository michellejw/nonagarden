import { describe, it, expect } from "vitest";
import { dateToPuzzle } from "./resolve";
import type { Puzzle } from "@/lib/nonogram";

const A: Puzzle = { id: "a", name: "Acorn", size: 2, rows: ["##", "##"] };
const C: Puzzle = { id: "c", name: "Cup", size: 2, rows: ["##", "##"] };
const PUZZLES = [A, C];
const TODAY = "2026-06-24"; // epoch + 2

describe("dateToPuzzle", () => {
  const schedule = ["a", "b", "c"]; // "b" has no matching puzzle

  it("resolves a past scheduled date to its puzzle", () => {
    expect(dateToPuzzle("2026-06-22", TODAY, schedule, PUZZLES)).toEqual({ kind: "puzzle", puzzle: A });
  });
  it("returns today for today's date", () => {
    expect(dateToPuzzle("2026-06-24", TODAY, schedule, PUZZLES)).toEqual({ kind: "today" });
  });
  it("gates a future date", () => {
    expect(dateToPuzzle("2026-06-25", TODAY, schedule, PUZZLES)).toEqual({ kind: "future" });
  });
  it("rejects a date before the epoch", () => {
    expect(dateToPuzzle("2026-06-21", TODAY, schedule, PUZZLES)).toEqual({ kind: "before-epoch" });
  });
  it("returns gap for an empty schedule slot", () => {
    expect(dateToPuzzle("2026-06-22", TODAY, ["", "b", "c"], PUZZLES)).toEqual({ kind: "gap" });
  });
  it("returns gap for a past date beyond the schedule", () => {
    expect(dateToPuzzle("2026-06-23", "2026-06-30", ["a"], PUZZLES)).toEqual({ kind: "gap" });
  });
  it("returns not-found when the scheduled id has no puzzle", () => {
    expect(dateToPuzzle("2026-06-23", TODAY, schedule, PUZZLES)).toEqual({ kind: "not-found" });
  });
});
