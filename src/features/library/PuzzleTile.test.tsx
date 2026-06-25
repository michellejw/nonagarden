import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PuzzleTile } from "./PuzzleTile";
import type { LibraryPuzzle } from "@/lib/content/content";

const PUZZLE: LibraryPuzzle = {
  id: "id-1",
  slug: "sprout",
  name: "Sprout",
  size: 5,
  rows: ["..#..", "..#..", "#.#.#", ".###.", "..#.."],
  difficulty: "forager",
};

describe("PuzzleTile", () => {
  it("links to the puzzle's play route", () => {
    render(<PuzzleTile puzzle={PUZZLE} cleared={false} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/library/sprout");
  });

  it("shows name, size, and difficulty", () => {
    render(<PuzzleTile puzzle={PUZZLE} cleared={false} />);
    expect(screen.getByText("Sprout")).toBeInTheDocument();
    expect(screen.getByText(/5\s*×\s*5/)).toBeInTheDocument();
    expect(screen.getByText(/forager/i)).toBeInTheDocument();
  });

  it("renders the revealed thumbnail only when cleared", () => {
    const { rerender } = render(<PuzzleTile puzzle={PUZZLE} cleared={false} />);
    expect(screen.queryByTestId("tile-thumbnail")).not.toBeInTheDocument();
    rerender(<PuzzleTile puzzle={PUZZLE} cleared={true} />);
    expect(screen.getByTestId("tile-thumbnail")).toBeInTheDocument();
  });
});
