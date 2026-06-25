// src/features/library/LibraryScreen.test.tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LibraryScreen } from "./LibraryScreen";
import { recordCleared } from "@/lib/library/cleared";
import { saveBoard } from "@/lib/library/store";
import type { LibraryPuzzleRow } from "@/lib/content/content";

const row = (slug: string, size: number, id = slug): LibraryPuzzleRow => ({
  id,
  slug,
  name: slug,
  size,
  rows: Array(size).fill("#".repeat(size)),
  difficulty: "forager",
});

beforeEach(() => {
  window.localStorage.clear();
});

describe("LibraryScreen", () => {
  it("renders a tile per included puzzle with a cleared counter", async () => {
    render(<LibraryScreen puzzles={[row("a", 5), row("b", 10)]} schedule={[]} />);
    // after client mount, a tile (link) appears per puzzle; names stay hidden
    // until solved, so identify tiles by their play-route links.
    const links = await screen.findAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/library/a",
      "/library/b",
    ]);
    expect(screen.getByText(/0\s*\/\s*2 cleared/i)).toBeInTheDocument();
    // Unsolved puzzles do NOT reveal their name.
    expect(screen.queryByText("a")).not.toBeInTheDocument();
  });

  it("marks a started-but-unsolved puzzle as in progress", async () => {
    saveBoard("a", { cells: [[1]], completed: false, elapsedMs: 1000 });
    render(<LibraryScreen puzzles={[row("a", 5), row("b", 10)]} schedule={[]} />);
    // Puzzle "a" has a saved board → in progress; "b" is untouched.
    expect(await screen.findByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("Not started")).toBeInTheDocument();
  });

  it("reflects cleared count from the ledger", async () => {
    recordCleared("a");
    render(<LibraryScreen puzzles={[row("a", 5), row("b", 10)]} schedule={[]} />);
    expect(await screen.findByText(/1\s*\/\s*2 cleared/i)).toBeInTheDocument();
  });

  it("shows an empty state when nothing is browsable", async () => {
    render(<LibraryScreen puzzles={[]} schedule={[]} />);
    expect(await screen.findByText(/still growing/i)).toBeInTheDocument();
  });
});
