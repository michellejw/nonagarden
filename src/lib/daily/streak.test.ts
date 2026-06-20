import { describe, it, expect } from "vitest";
import { completeDaily, currentStreakAsOf, type StreakState } from "./streak";

const fresh: StreakState = { current: 0, lastCompleted: null };

describe("completeDaily", () => {
  it("starts a streak at 1 from nothing", () => {
    expect(completeDaily(fresh, "2026-06-22")).toEqual({ current: 1, lastCompleted: "2026-06-22" });
  });
  it("increments on a consecutive day", () => {
    const a = completeDaily(fresh, "2026-06-22");
    expect(completeDaily(a, "2026-06-23")).toEqual({ current: 2, lastCompleted: "2026-06-23" });
  });
  it("is idempotent when completing the same day twice", () => {
    const a = completeDaily(fresh, "2026-06-22");
    expect(completeDaily(a, "2026-06-22")).toEqual(a);
  });
  it("resets to 1 after a missed day (gap > 1)", () => {
    const a = { current: 5, lastCompleted: "2026-06-22" };
    expect(completeDaily(a, "2026-06-24")).toEqual({ current: 1, lastCompleted: "2026-06-24" });
  });
});

describe("currentStreakAsOf", () => {
  it("is 0 with no history", () => {
    expect(currentStreakAsOf(fresh, "2026-06-22")).toBe(0);
  });
  it("shows the streak on the completed day", () => {
    expect(currentStreakAsOf({ current: 3, lastCompleted: "2026-06-22" }, "2026-06-22")).toBe(3);
  });
  it("still shows the streak the day after (not yet broken)", () => {
    expect(currentStreakAsOf({ current: 3, lastCompleted: "2026-06-22" }, "2026-06-23")).toBe(3);
  });
  it("reads as broken (0) once a day is missed", () => {
    expect(currentStreakAsOf({ current: 3, lastCompleted: "2026-06-22" }, "2026-06-24")).toBe(0);
  });
});
