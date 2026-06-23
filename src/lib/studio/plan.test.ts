import { describe, expect, it } from "vitest";
import { planPublish, planSchedule } from "./plan";
import type { Puzzle } from "../nonogram";

const FULL: Puzzle = { id: "full", name: "Full", size: 2, rows: ["##", "##"] };
const AMB: Puzzle = { id: "amb", name: "Amb", size: 2, rows: ["#.", ".#"] };

describe("planPublish", () => {
  it("produces a published row for a valid approved candidate", () => {
    const plan = planPublish([FULL, AMB], ["full"]);
    expect(plan.valid).toEqual([
      { slug: "full", name: "Full", size: 2, rows: ["##", "##"], difficulty: "forager", status: "published" },
    ]);
    expect(plan.rejected).toEqual([]);
  });

  it("rejects invalid candidates and unknown ids, preserving order", () => {
    const plan = planPublish([FULL, AMB], ["amb", "ghost"]);
    expect(plan.valid).toEqual([]);
    expect(plan.rejected.map((r) => r.id)).toEqual(["amb", "ghost"]);
    expect(plan.rejected[0].reason).toMatch(/line-solvable|solution/);
    expect(plan.rejected[1].reason).toMatch(/not found/);
  });
});

describe("planSchedule", () => {
  it("appends new ids after the current max position", () => {
    const existing = [
      { position: 0, puzzleId: "a" },
      { position: 1, puzzleId: "b" },
    ];
    expect(planSchedule(["b", "c", "d", "c"], existing)).toEqual([
      { position: 2, puzzleId: "c" },
      { position: 3, puzzleId: "d" },
    ]);
  });

  it("starts at 0 for an empty schedule", () => {
    expect(planSchedule(["x", "y"], [])).toEqual([
      { position: 0, puzzleId: "x" },
      { position: 1, puzzleId: "y" },
    ]);
  });
});
