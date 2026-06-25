import { describe, it, expect, beforeEach } from "vitest";
import {
  loadLibraryStore,
  saveBoard,
  dropBoard,
  boardFor,
  defaultLibraryStore,
  type LibraryBoard,
} from "./store";

const KEY = "nonagarden.library.v1";
const BOARD: LibraryBoard = { cells: [[1, 0], [0, 2]], completed: false, elapsedMs: 1200 };

beforeEach(() => {
  window.localStorage.clear();
});

describe("library in-progress store", () => {
  it("returns defaults when empty", () => {
    expect(loadLibraryStore()).toEqual(defaultLibraryStore());
  });

  it("saves and reads back a board by id", () => {
    saveBoard("p1", BOARD);
    expect(boardFor(loadLibraryStore(), "p1")).toEqual(BOARD);
    expect(boardFor(loadLibraryStore(), "missing")).toBeUndefined();
  });

  it("overwrites an existing board for the same id", () => {
    saveBoard("p1", BOARD);
    const updated: LibraryBoard = { ...BOARD, elapsedMs: 9999 };
    saveBoard("p1", updated);
    expect(boardFor(loadLibraryStore(), "p1")).toEqual(updated);
  });

  it("drops a board by id", () => {
    saveBoard("p1", BOARD);
    saveBoard("p2", BOARD);
    dropBoard("p1");
    const store = loadLibraryStore();
    expect(boardFor(store, "p1")).toBeUndefined();
    expect(boardFor(store, "p2")).toEqual(BOARD);
  });

  it("falls back to defaults on corrupt data", () => {
    window.localStorage.setItem(KEY, "nope");
    expect(loadLibraryStore()).toEqual(defaultLibraryStore());
  });
});
