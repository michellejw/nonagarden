// src/features/archive/ArchivePlayScreen.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ArchivePlayScreen } from "./ArchivePlayScreen";
import { recordCleared } from "@/lib/library/cleared";
import type { Puzzle } from "@/lib/nonogram";

const PUZZLES: Puzzle[] = [
  { id: "a", name: "Acorn", size: 2, rows: ["##", "##"] },
  { id: "c", name: "Cup", size: 2, rows: ["##", "##"] },
];
const SCHEDULE = ["a", "b", "c"];
const TODAY = "2026-06-24"; // epoch + 2

beforeEach(() => window.localStorage.clear());

describe("ArchivePlayScreen", () => {
  it("plays an uncleared past day with a hidden name and a back link", async () => {
    render(<ArchivePlayScreen date="2026-06-22" puzzles={PUZZLES} schedule={SCHEDULE} nowDate={TODAY} />);
    await screen.findByRole("grid");
    // Name stays hidden: the answer "Acorn" must not appear before solving.
    expect(screen.queryByText(/acorn/i)).toBeNull();
    expect(screen.getByRole("link", { name: /back to archive/i })).toHaveAttribute("href", "/archive");
  });

  it("opens a cleared day in the reveal view and reveals the name", async () => {
    recordCleared("a");
    render(<ArchivePlayScreen date="2026-06-22" puzzles={PUZZLES} schedule={SCHEDULE} nowDate={TODAY} />);
    expect(await screen.findByText(/acorn/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /play again/i })).toBeInTheDocument();
    // The reveal view is not the playable board.
    expect(screen.queryByRole("grid")).toBeNull();
  });

  it("Play again swaps the reveal for a fresh board", async () => {
    recordCleared("a");
    render(<ArchivePlayScreen date="2026-06-22" puzzles={PUZZLES} schedule={SCHEDULE} nowDate={TODAY} />);
    fireEvent.click(await screen.findByRole("button", { name: /play again/i }));
    expect(await screen.findByRole("grid")).toBeInTheDocument();
  });

  it("gates a future date", async () => {
    render(<ArchivePlayScreen date="2026-06-25" puzzles={PUZZLES} schedule={SCHEDULE} nowDate={TODAY} />);
    expect(await screen.findByText(/hasn't sprouted yet/i)).toBeInTheDocument();
  });

  it("sends today's date back to the front door", async () => {
    render(<ArchivePlayScreen date="2026-06-24" puzzles={PUZZLES} schedule={SCHEDULE} nowDate={TODAY} />);
    expect(await screen.findByRole("link", { name: /today's daily/i })).toHaveAttribute("href", "/");
  });
});
