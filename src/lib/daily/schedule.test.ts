import { describe, it, expect } from "vitest";
import { daysSince, dailyFor } from "./schedule";
import { DAILY_EPOCH } from "./list";

const LIST = ["a", "b", "c"];

describe("daysSince", () => {
  it("is 0 for the same date", () => {
    expect(daysSince("2026-06-22", "2026-06-22")).toBe(0);
  });
  it("counts whole calendar days forward", () => {
    expect(daysSince("2026-06-22", "2026-06-25")).toBe(3);
  });
  it("is negative before the epoch", () => {
    expect(daysSince("2026-06-22", "2026-06-21")).toBe(-1);
  });
  it("counts correctly across a US DST spring-forward (2026-03-08)", () => {
    expect(daysSince("2026-03-07", "2026-03-09")).toBe(2);
  });
  it("counts correctly across a fall-back (2026-11-01)", () => {
    expect(daysSince("2026-10-31", "2026-11-02")).toBe(2);
  });
});

describe("dailyFor", () => {
  it("maps the epoch day to index 0", () => {
    expect(dailyFor("2026-06-22", LIST, "2026-06-22")).toEqual({
      kind: "puzzle", puzzleId: "a", index: 0,
    });
  });
  it("walks the list by day offset", () => {
    expect(dailyFor("2026-06-24", LIST, "2026-06-22")).toEqual({
      kind: "puzzle", puzzleId: "c", index: 2,
    });
  });
  it("returns before-epoch for earlier dates", () => {
    expect(dailyFor("2026-06-21", LIST, "2026-06-22")).toEqual({ kind: "before-epoch" });
  });
  it("returns none once it runs off the end", () => {
    expect(dailyFor("2026-06-25", LIST, "2026-06-22")).toEqual({ kind: "none" });
  });
  it("defaults to the real DAILY_LIST + DAILY_EPOCH", () => {
    expect(dailyFor(DAILY_EPOCH).kind).toBe("puzzle");
  });
  // PINNING TEST — guards append-only. If this fails after editing DAILY_LIST,
  // you reordered/inserted instead of appending. Fix the list, not these pins.
  it("pins historical (date -> puzzleId) so reorders fail CI", () => {
    expect(dailyFor("2026-06-22")).toMatchObject({ index: 0, puzzleId: "sprout" });
    expect(dailyFor("2026-06-23")).toMatchObject({ index: 1, puzzleId: "diamond" });
    expect(dailyFor("2026-06-24")).toMatchObject({ index: 2, puzzleId: "toadstool" });
  });
});
