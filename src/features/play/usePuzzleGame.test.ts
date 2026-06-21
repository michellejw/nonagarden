import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePuzzleGame } from "./usePuzzleGame";
import type { Puzzle } from "@/lib/nonogram";

const P: Puzzle = { id: "t", name: "Tee", size: 2, rows: ["##", ".#"] };

describe("usePuzzleGame options", () => {
  it("with no options, starts from an empty board (unchanged behavior)", () => {
    const { result } = renderHook(() => usePuzzleGame([P]));
    expect(result.current.cells).toEqual([[0, 0], [0, 0]]);
    expect(result.current.won).toBe(false);
  });

  it("seeds the board from opts.initial", () => {
    const { result } = renderHook(() =>
      usePuzzleGame([P], { initial: { cells: [[1, 0], [0, 1]], won: false, frozenElapsed: 0 } }),
    );
    expect(result.current.cells).toEqual([[1, 0], [0, 1]]);
  });

  it("restores a completed board (won + frozen time)", () => {
    const { result } = renderHook(() =>
      usePuzzleGame([P], { initial: { cells: [[1, 1], [0, 1]], won: true, frozenElapsed: 5000 } }),
    );
    expect(result.current.won).toBe(true);
    expect(result.current.elapsedMs).toBe(5000);
  });

  it("calls onChange with a snapshot when the board changes", () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => usePuzzleGame([P], { onChange }));
    act(() => result.current.paint(0, 0, 1));
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls.at(-1)![0];
    expect(last.cells[0][0]).toBe(1);
  });
});
