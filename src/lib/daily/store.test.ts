import { describe, it, expect, beforeEach } from "vitest";
import { loadStore, saveStore, defaultStore, type DailyStore } from "./store";

const KEY = "nonagarden.daily.v1";

beforeEach(() => {
  window.localStorage.clear();
});

describe("daily store", () => {
  it("returns defaults when nothing is stored", () => {
    expect(loadStore()).toEqual(defaultStore());
  });
  it("round-trips a saved store", () => {
    const s: DailyStore = {
      version: 1,
      streak: { current: 4, lastCompleted: "2026-06-25" },
      today: { date: "2026-06-25", puzzleId: "sprout", cells: [[1, 0]], completed: false, elapsedMs: 1234 },
    };
    saveStore(s);
    expect(loadStore()).toEqual(s);
  });
  it("falls back to defaults on malformed JSON (never throws)", () => {
    window.localStorage.setItem(KEY, "{not json");
    expect(loadStore()).toEqual(defaultStore());
  });
  it("falls back to defaults on a wrong/old version", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ version: 99, streak: {}, today: null }));
    expect(loadStore()).toEqual(defaultStore());
  });
  it("falls back to defaults on a shape mismatch", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ version: 1, streak: "nope", today: null }));
    expect(loadStore()).toEqual(defaultStore());
  });
});
