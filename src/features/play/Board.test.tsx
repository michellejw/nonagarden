import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Board } from "./Board";
import { cluesFor, emptyGrid, type Puzzle } from "@/lib/nonogram";

const tee: Puzzle = { id: "t", name: "Tee", size: 3, rows: ["###", ".#.", ".#."] };

function setup(onPaint = vi.fn()) {
  const { rowClues, colClues } = cluesFor(tee);
  render(
    <Board
      size={3}
      cells={emptyGrid(3)}
      rowClues={rowClues}
      colClues={colClues}
      rowState={["normal", "normal", "normal"]}
      colState={["normal", "normal", "normal"]}
      primaryValueAt={() => 1}
      markValueAt={() => 2}
      paint={onPaint}
    />,
  );
  return onPaint;
}

describe("Board", () => {
  it("exposes a 3×3 grid of gridcells", () => {
    setup();
    expect(screen.getByRole("grid")).toBeInTheDocument();
    expect(screen.getAllByRole("gridcell")).toHaveLength(9);
  });

  it("pointer down paints with the primary value", () => {
    const paint = setup();
    fireEvent.pointerDown(screen.getAllByRole("gridcell")[0], { button: 0 });
    expect(paint).toHaveBeenCalledWith(0, 0, 1);
  });

  it("space fills the focused cell", () => {
    const paint = setup();
    const first = screen.getAllByRole("gridcell")[0];
    first.focus();
    fireEvent.keyDown(first, { key: " " });
    expect(paint).toHaveBeenCalledWith(0, 0, 1);
  });

  it("x marks the focused cell", () => {
    const paint = setup();
    const first = screen.getAllByRole("gridcell")[0];
    first.focus();
    fireEvent.keyDown(first, { key: "x" });
    expect(paint).toHaveBeenCalledWith(0, 0, 2);
  });

  it("ArrowRight moves the roving tabindex", () => {
    setup();
    const cells = screen.getAllByRole("gridcell");
    cells[0].focus();
    fireEvent.keyDown(cells[0], { key: "ArrowRight" });
    expect(cells[1]).toHaveAttribute("tabindex", "0");
    expect(cells[0]).toHaveAttribute("tabindex", "-1");
  });
});
