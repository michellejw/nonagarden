import { describe, it, expect } from "vitest";
import { mapContent, fetchDailyContent } from "./content";

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

describe("fetchDailyContent", () => {
  const puzzleRows = [{ id: "a", name: "Acorn", size: 5, rows: ["#####"] }];
  const scheduleRows = [{ position: 0, puzzle_id: "a" }];

  // Minimal stub of the Supabase query builder: `.from(t).select(c)` is awaitable
  // (schedule path) and also exposes `.eq()` returning a promise (puzzles path).
  function fakeClient(opts: { puzzleError?: unknown; scheduleError?: unknown } = {}) {
    return {
      from(table: string) {
        const res =
          table === "puzzles"
            ? { data: puzzleRows, error: opts.puzzleError ?? null }
            : { data: scheduleRows, error: opts.scheduleError ?? null };
        const thenable = {
          eq: () => Promise.resolve(res),
          then: (
            resolve: (v: unknown) => unknown,
            reject?: (e: unknown) => unknown,
          ) => Promise.resolve(res).then(resolve, reject),
        };
        return { select: () => thenable };
      },
    };
  }

  it("returns content mapped from both tables", async () => {
    const content = await fetchDailyContent(fakeClient() as never);
    expect(content.puzzles).toEqual([{ id: "a", name: "Acorn", size: 5, rows: ["#####"] }]);
    expect(content.schedule).toEqual(["a"]);
  });

  it("throws when the puzzles query errors", async () => {
    await expect(
      fetchDailyContent(fakeClient({ puzzleError: new Error("boom") }) as never),
    ).rejects.toThrow("boom");
  });

  it("throws when the schedule query errors", async () => {
    await expect(
      fetchDailyContent(fakeClient({ scheduleError: new Error("nope") }) as never),
    ).rejects.toThrow("nope");
  });
});
