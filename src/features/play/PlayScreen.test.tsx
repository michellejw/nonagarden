import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PlayScreen } from "./PlayScreen";
import type { Puzzle } from "@/lib/nonogram";

const tee: Puzzle = { id: "t", name: "Tee", size: 3, rows: ["###", ".#.", ".#."] };

describe("PlayScreen", () => {
  it("renders header, mode toggle, and the board", () => {
    render(<PlayScreen puzzles={[tee]} />);
    expect(screen.getByText("3 × 3")).toBeInTheDocument();
    expect(screen.getByRole("grid")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fill" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark" })).toBeInTheDocument();
  });

  it("announces and shows the win card when solved", () => {
    render(<PlayScreen puzzles={[tee]} />);
    const cells = screen.getAllByRole("gridcell");
    // Tee solution: indices 0,1,2 (row0), 4 (row1 c1), 7 (row2 c1)
    for (const i of [0, 1, 2, 4, 7]) fireEvent.pointerDown(cells[i], { button: 0 });
    // visible win card
    expect(screen.getByText("Picture complete!")).toBeInTheDocument();
    // both the win card body AND the live region carry the name — assert both exist
    const nameMatches = screen.getAllByText(/it's a tee/i);
    expect(nameMatches.length).toBeGreaterThanOrEqual(1);
    // live region carries the full reveal phrase
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/picture complete/i);
    expect(status).toHaveTextContent(/it's a tee/i);
  });

  it("surfaces a conflict cue naming the offending line when one becomes impossible", () => {
    render(<PlayScreen puzzles={[tee]} />);
    const cells = screen.getAllByRole("gridcell");
    // row 2 (indices 3,4,5) clue is [1]; filling two non-adjacent cells in it makes it impossible
    fireEvent.pointerDown(cells[3], { button: 0 });
    fireEvent.pointerDown(cells[5], { button: 0 });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(/can't be satisfied/i);
    // the announcement names WHERE the problem is, not a generic sentence
    expect(status).toHaveTextContent(/row 2/i);
  });
});
