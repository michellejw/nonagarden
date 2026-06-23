import { describe, it, expect } from "vitest";
import {
  mapLibraryContent,
  fetchLibraryContent,
  type LibraryPuzzleRow,
} from "./content";

const rows = (slug: string, id = slug): LibraryPuzzleRow => ({
  id,
  slug,
  name: slug,
  size: 5,
  rows: ["#####", "#####", "#####", "#####", "#####"],
  difficulty: "forager",
});

describe("mapLibraryContent", () => {
  it("includes unscheduled puzzles always", () => {
    const out = mapLibraryContent([rows("a"), rows("b")], [], 0);
    expect(out.map((p) => p.slug)).toEqual(["a", "b"]);
  });

  it("includes a puzzle scheduled at exactly today (position == todayPosition)", () => {
    const out = mapLibraryContent(
      [rows("a", "id-a")],
      [{ position: 3, puzzle_id: "id-a" }],
      3,
    );
    expect(out.map((p) => p.slug)).toEqual(["a"]);
  });

  it("excludes a puzzle scheduled in the future (position > todayPosition)", () => {
    const out = mapLibraryContent(
      [rows("a", "id-a"), rows("b", "id-b")],
      [
        { position: 2, puzzle_id: "id-a" },
        { position: 4, puzzle_id: "id-b" },
      ],
      3,
    );
    expect(out.map((p) => p.slug)).toEqual(["a"]); // b is future
  });

  it("excludes everything scheduled when before epoch (todayPosition negative)", () => {
    const out = mapLibraryContent(
      [rows("a", "id-a"), rows("u")],
      [{ position: 0, puzzle_id: "id-a" }],
      -1,
    );
    expect(out.map((p) => p.slug)).toEqual(["u"]); // only the unscheduled one
  });
});

describe("fetchLibraryContent", () => {
  it("returns published rows + schedule from the client", async () => {
    const client = {
      from(table: string) {
        if (table === "puzzles") {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: [rows("a")], error: null }),
            }),
          } as never;
        }
        return {
          select: () =>
            Promise.resolve({ data: [{ position: 0, puzzle_id: "a" }], error: null }),
        } as never;
      },
    };
    const out = await fetchLibraryContent(client as never);
    expect(out.puzzles.map((p) => p.slug)).toEqual(["a"]);
    expect(out.schedule).toEqual([{ position: 0, puzzle_id: "a" }]);
  });

  it("throws when the puzzles query errors", async () => {
    const client = {
      from(table: string) {
        if (table === "puzzles") {
          return {
            select: () => ({
              eq: () => Promise.resolve({ data: null, error: new Error("boom") }),
            }),
          } as never;
        }
        return {
          select: () => Promise.resolve({ data: [], error: null }),
        } as never;
      },
    };
    await expect(fetchLibraryContent(client as never)).rejects.toThrow();
  });
});
