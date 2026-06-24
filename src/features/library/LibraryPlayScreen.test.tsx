import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { LibraryPlayScreen } from "./LibraryPlayScreen";
import { loadCleared } from "@/lib/library/cleared";
import { loadLibraryStore, boardFor, saveBoard } from "@/lib/library/store";
import type { LibraryPuzzle } from "@/lib/content/content";

// 2×2: solution fills the whole grid → fill all 4 cells to win.
const PUZZLE: LibraryPuzzle = {
  id: "id-2x2",
  slug: "block",
  name: "Block",
  size: 2,
  rows: ["##", "##"],
  difficulty: "forager",
};

// All cells are filled in the solution.
const FILLS: [number, number][] = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
];

beforeEach(() => {
  window.localStorage.clear();
});

describe("LibraryPlayScreen", () => {
  it("renders the puzzle board with its size", () => {
    render(<LibraryPlayScreen puzzle={PUZZLE} />);
    expect(screen.getByText(/2\s*×\s*2/)).toBeInTheDocument();
  });

  it("resumes from a saved in-progress board", async () => {
    // Save a board with top-left cell filled (value=1).
    saveBoard("id-2x2", { cells: [[1, 0], [0, 0]], completed: false, elapsedMs: 5000 });
    render(<LibraryPlayScreen puzzle={PUZZLE} />);
    // Wait for the ready gate to resolve (useEffect sets ready=true).
    await screen.findByRole("grid");
    // CellButton aria-label is "Row R, column C, filled" when value===1.
    // The saved board seeds row 0 col 0 with value 1 → "filled" in its label.
    const filledCells = screen
      .getAllByRole("gridcell")
      .filter((b) => b.getAttribute("aria-label")?.includes("filled"));
    expect(filledCells.length).toBeGreaterThan(0);
  });

  it("offers a Back to library link", () => {
    render(<LibraryPlayScreen puzzle={PUZZLE} />);
    expect(screen.getByRole("link", { name: /back to library/i })).toHaveAttribute(
      "href",
      "/library",
    );
  });

  it("does not store a board when the puzzle is opened but not played", async () => {
    render(<LibraryPlayScreen puzzle={PUZZLE} />);
    await screen.findByRole("grid"); // ready gate resolved
    expect(boardFor(loadLibraryStore(), "id-2x2")).toBeUndefined();
  });

  it("on win: records to ledger and drops the in-progress board", async () => {
    render(<LibraryPlayScreen puzzle={PUZZLE} />);
    // Wait for the board to mount (ready gate).
    await screen.findByRole("grid");
    const grid = screen.getByRole("grid");
    for (const [r, c] of FILLS) {
      fireEvent.pointerDown(
        within(grid).getByLabelText(new RegExp(`Row ${r + 1}, column ${c + 1}`, "i")),
      );
    }
    expect(
      await screen.findByRole("heading", { name: /Picture complete/i }),
    ).toBeInTheDocument();
    // Ledger should record "id-2x2".
    expect(loadCleared().ids).toContain("id-2x2");
    // In-progress board should be dropped.
    expect(boardFor(loadLibraryStore(), "id-2x2")).toBeUndefined();
  });
});
