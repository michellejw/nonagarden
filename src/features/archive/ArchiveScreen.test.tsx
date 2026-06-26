// src/features/archive/ArchiveScreen.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ArchiveScreen } from "./ArchiveScreen";
import { recordCleared } from "@/lib/library/cleared";
import type { Puzzle } from "@/lib/nonogram";

const PUZZLES: Puzzle[] = [
  { id: "a", name: "Acorn", size: 2, rows: ["##", "##"] },
  { id: "b", name: "Bee", size: 2, rows: ["##", "##"] },
  { id: "c", name: "Cup", size: 2, rows: ["##", "##"] },
];
const SCHEDULE = ["a", "b", "c"]; // epoch+0,+1,+2

beforeEach(() => window.localStorage.clear());

describe("ArchiveScreen", () => {
  it("renders the Archive heading and the epoch month", async () => {
    render(<ArchiveScreen puzzles={PUZZLES} schedule={SCHEDULE} nowDate="2026-06-24" />);
    expect(await screen.findByRole("heading", { name: "Archive" })).toBeInTheDocument();
    expect(screen.getByText("June 2026")).toBeInTheDocument();
  });

  it("links a past day to its dated route and today to the front door", async () => {
    render(<ArchiveScreen puzzles={PUZZLES} schedule={SCHEDULE} nowDate="2026-06-24" />);
    expect(await screen.findByRole("link", { name: /2026-06-22/i })).toHaveAttribute(
      "href", "/archive/2026-06-22",
    );
    expect(screen.getByRole("link", { name: /2026-06-24/i })).toHaveAttribute("href", "/");
  });

  it("marks a cleared day as cleared in its label", async () => {
    recordCleared("a");
    render(<ArchiveScreen puzzles={PUZZLES} schedule={SCHEDULE} nowDate="2026-06-24" />);
    expect(await screen.findByRole("link", { name: /2026-06-22.*cleared/i })).toBeInTheDocument();
  });
});
