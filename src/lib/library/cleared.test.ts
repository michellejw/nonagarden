import { describe, it, expect, beforeEach } from "vitest";
import {
  loadCleared,
  recordCleared,
  isCleared,
  defaultCleared,
  type ClearedStore,
} from "./cleared";

const KEY = "nonagarden.cleared.v1";

beforeEach(() => {
  window.localStorage.clear();
});

describe("completion ledger", () => {
  it("returns defaults when nothing is stored", () => {
    expect(loadCleared()).toEqual(defaultCleared());
    expect(loadCleared().ids).toEqual([]);
  });

  it("records a cleared id and persists it", () => {
    const next = recordCleared("abc");
    expect(next.ids).toEqual(["abc"]);
    expect(loadCleared().ids).toEqual(["abc"]);
  });

  it("dedupes repeated ids", () => {
    recordCleared("abc");
    const next = recordCleared("abc");
    expect(next.ids).toEqual(["abc"]);
  });

  it("isCleared reflects membership", () => {
    const store: ClearedStore = { version: 1, ids: ["x", "y"] };
    expect(isCleared(store, "y")).toBe(true);
    expect(isCleared(store, "z")).toBe(false);
  });

  it("falls back to defaults on corrupt data", () => {
    window.localStorage.setItem(KEY, "{ not json");
    expect(loadCleared()).toEqual(defaultCleared());
    window.localStorage.setItem(KEY, JSON.stringify({ version: 2, ids: ["a"] }));
    expect(loadCleared()).toEqual(defaultCleared());
  });
});
