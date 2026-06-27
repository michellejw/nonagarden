import { describe, it, expect } from "vitest";
import { buildCalendar, type DayCell, type CalendarModel } from "./calendar";

const EPOCH = "2026-06-22";

function cellFor(model: CalendarModel, date: string): DayCell | undefined {
  for (const m of model.months) {
    const hit = m.cells.find((c) => c.date === date);
    if (hit) return hit;
  }
  return undefined;
}

describe("buildCalendar", () => {
  const base = {
    epoch: EPOCH,
    today: "2026-06-24",
    schedule: ["a", "b", "c"] as const,
    clearedIds: new Set(["a"]),
    inProgressIds: new Set(["b"]),
  };

  it("classifies cleared, in-progress, today, future and before-epoch days", () => {
    const model = buildCalendar(base);
    expect(cellFor(model, "2026-06-22")).toMatchObject({ state: "cleared", puzzleId: "a" });
    expect(cellFor(model, "2026-06-23")).toMatchObject({ state: "in-progress", puzzleId: "b" });
    expect(cellFor(model, "2026-06-24")).toMatchObject({ state: "today", puzzleId: "c", cleared: false });
    expect(cellFor(model, "2026-06-25")).toMatchObject({ state: "future" });
    expect(cellFor(model, "2026-06-21")).toMatchObject({ state: "before-epoch" });
  });

  it("marks an untouched past day uncleared and an empty schedule slot as a gap", () => {
    const model = buildCalendar({
      ...base,
      today: "2026-06-25",
      schedule: ["a", "", "c"],
      clearedIds: new Set<string>(),
      inProgressIds: new Set<string>(),
    });
    expect(cellFor(model, "2026-06-22")).toMatchObject({ state: "uncleared", puzzleId: "a" });
    expect(cellFor(model, "2026-06-23")).toMatchObject({ state: "gap" });
  });

  it("shows today's mushroom as cleared when today is solved", () => {
    const model = buildCalendar({ ...base, clearedIds: new Set(["a", "c"]) });
    expect(cellFor(model, "2026-06-24")).toMatchObject({ state: "today", cleared: true });
  });

  it("lists the epoch month most-recent-first with a leading weekday pad", () => {
    const model = buildCalendar(base);
    expect(model.months[0].label).toBe("June 2026");
    // June 1 2026 is a Monday → one leading Sunday pad cell.
    expect(model.months[0].cells[0]).toEqual({ date: null, day: null, state: "pad" });
  });

  it("spans multiple months, most-recent first, each with its own pad", () => {
    const model = buildCalendar({
      epoch: "2026-06-22",
      today: "2026-08-03",
      schedule: [],
      clearedIds: new Set<string>(),
      inProgressIds: new Set<string>(),
    });
    expect(model.months.map((m) => m.label)).toEqual(["August 2026", "July 2026", "June 2026"]);
    // July 15 is a past in-range day with no schedule entry (empty schedule) → gap
    expect(cellFor(model, "2026-07-15")).toMatchObject({ state: "gap" });
    // each month contains day 1
    for (const m of model.months) {
      const firstReal = m.cells.find((c) => c.day === 1);
      expect(firstReal).toBeTruthy();
    }
  });
});
