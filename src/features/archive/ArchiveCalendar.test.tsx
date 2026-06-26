import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ArchiveCalendar } from "./ArchiveCalendar";
import type { CalendarModel } from "@/lib/archive/calendar";

const MODEL: CalendarModel = {
  months: [
    {
      year: 2026, month: 6, label: "June 2026",
      cells: [
        { date: null, day: null, state: "pad" },
        { date: "2026-06-22", day: 22, state: "cleared", puzzleId: "a" },
        { date: "2026-06-23", day: 23, state: "uncleared", puzzleId: "b" },
        { date: "2026-06-24", day: 24, state: "today", puzzleId: "c", cleared: false },
        { date: "2026-06-25", day: 25, state: "future" },
      ],
    },
  ],
};

describe("ArchiveCalendar", () => {
  it("shows the month label", () => {
    render(<ArchiveCalendar model={MODEL} />);
    expect(screen.getByText("June 2026")).toBeInTheDocument();
  });

  it("links a cleared past day to its dated play route and marks it cleared", () => {
    render(<ArchiveCalendar model={MODEL} />);
    const link = screen.getByRole("link", { name: /2026-06-22.*cleared/i });
    expect(link).toHaveAttribute("href", "/archive/2026-06-22");
  });

  it("links today's cell to the front door", () => {
    render(<ArchiveCalendar model={MODEL} />);
    const link = screen.getByRole("link", { name: /2026-06-24/i });
    expect(link).toHaveAttribute("href", "/");
  });

  it("renders no link for a future day", () => {
    render(<ArchiveCalendar model={MODEL} />);
    expect(screen.queryByRole("link", { name: /2026-06-25/i })).toBeNull();
  });
});
