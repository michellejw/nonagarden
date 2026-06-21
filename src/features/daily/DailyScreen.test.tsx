import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { DailyScreen } from "./DailyScreen";
import { saveStore, type DailyStore } from "@/lib/daily";

// 2026-06-22 is DAILY_EPOCH → index 0 → "sprout" (5x5). Its solution rows:
const SPROUT_FILLS: [number, number][] = [];
const SPROUT_ROWS = ["..#..", "..#..", "#.#.#", ".###.", "..#.."];
SPROUT_ROWS.forEach((row, r) =>
  row.split("").forEach((ch, c) => { if (ch === "#") SPROUT_FILLS.push([r, c]); }),
);

beforeEach(() => window.localStorage.clear());

describe("DailyScreen", () => {
  it("renders today's puzzle name-free header with the date", async () => {
    render(<DailyScreen nowDate="2026-06-22" />);
    expect(await screen.findByText(/June 22/)).toBeInTheDocument();
    // a grid is shown (DailyBoard mounted)
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });

  it("shows the caught-up state past the end of the schedule", async () => {
    render(<DailyScreen nowDate="2099-01-01" />);
    expect(await screen.findByText(/caught up/i)).toBeInTheDocument();
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("solving the daily shows the done card and increments the streak", async () => {
    render(<DailyScreen nowDate="2026-06-22" />);
    await screen.findByRole("grid");
    const grid = screen.getByRole("grid");
    for (const [r, c] of SPROUT_FILLS) {
      fireEvent.pointerDown(within(grid).getByLabelText(new RegExp(`Row ${r + 1}, column ${c + 1}`, "i")));
    }
    expect(await screen.findByText(/Picture complete/i)).toBeInTheDocument();
    expect(screen.getByText(/come back tomorrow/i)).toBeInTheDocument();
    expect(screen.getByText(/1 day streak/i)).toBeInTheDocument();
  });

  it("restores a completed-today board as done on load (no re-offer)", async () => {
    const done: DailyStore = {
      version: 1,
      streak: { current: 1, lastCompleted: "2026-06-22" },
      today: { date: "2026-06-22", puzzleId: "sprout", cells:
        SPROUT_ROWS.map((row) => row.split("").map((ch) => (ch === "#" ? 1 : 0))),
        completed: true, elapsedMs: 4000 },
    };
    saveStore(done);
    render(<DailyScreen nowDate="2026-06-22" />);
    expect(await screen.findByText(/Picture complete/i)).toBeInTheDocument();
  });
});
