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

  it("hides the puzzle name until solved, revealing it only when cleared", () => {
    const { rerender } = render(<PuzzleTile puzzle={PUZZLE} cleared={false} />);
    // Unsolved: name hidden; difficulty still visible (size lives in the
    // section header, not per tile).
    expect(screen.queryByText("Sprout")).not.toBeInTheDocument();
    expect(screen.getByText(/forager/i)).toBeInTheDocument();
    // Solved: name revealed.
    rerender(<PuzzleTile puzzle={PUZZLE} cleared={true} />);
    expect(screen.getByText("Sprout")).toBeInTheDocument();
  });

  it("renders the revealed thumbnail only when cleared", () => {
    const { rerender } = render(<PuzzleTile puzzle={PUZZLE} cleared={false} />);
    expect(screen.queryByTestId("tile-thumbnail")).not.toBeInTheDocument();
    rerender(<PuzzleTile puzzle={PUZZLE} cleared={true} />);
    expect(screen.getByTestId("tile-thumbnail")).toBeInTheDocument();
  });

  it("shows a muted mushroom when untouched and a full-colour one in progress", () => {
    const { rerender } = render(
      <PuzzleTile puzzle={PUZZLE} cleared={false} inProgress={false} />,
    );
    // Untouched: mushroom is muted/grayscale; no visible "In progress" label.
    expect(screen.getByText("🍄").className).toContain("grayscale");
    expect(screen.getByText("Not started")).toBeInTheDocument();
    expect(screen.queryByText("In progress")).not.toBeInTheDocument();

    // In progress: same mushroom, full colour (no grayscale) + visible label.
    rerender(<PuzzleTile puzzle={PUZZLE} cleared={false} inProgress={true} />);
    expect(screen.getByText("🍄").className).not.toContain("grayscale");
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });
});
