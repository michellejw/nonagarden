"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import type { Cell, Clue, Puzzle } from "@/lib/nonogram";
import { cluesFor, column, lineState, type LineState } from "@/lib/nonogram";
import { reducer, initState, type Mode } from "./reducer";

export interface PlayApi {
  puzzle: Puzzle;
  cells: Cell[][];
  mode: Mode;
  won: boolean;
  elapsedMs: number;
  rowClues: Clue[];
  colClues: Clue[];
  rowState: LineState[];
  colState: LineState[];
  hasConflict: boolean;
  paint(r: number, c: number, value: Cell): void;
  primaryValueAt(r: number, c: number): Cell; // what a fill/mark-mode press would set
  markValueAt(r: number, c: number): Cell; // what a mark toggle would set
  setMode(m: Mode): void;
  reset(): void;
  next(): void;
}

export function usePuzzleGame(puzzles: Puzzle[]): PlayApi {
  const [state, dispatch] = useReducer(reducer, puzzles, initState);
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!state.startTs || state.won) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: fires once when the timer starts to avoid a 0:00 cold-start flash; not a cascade, just an immediate clock sync
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [state.startTs, state.won]);

  const { rowClues, colClues } = useMemo(() => cluesFor(state.puzzle), [state.puzzle]);

  const rowState = useMemo(
    () => state.cells.map((row, i) => lineState(row, rowClues[i], state.won)),
    [state.cells, rowClues, state.won],
  );
  const colState = useMemo(
    () => colClues.map((cl, c) => lineState(column(state.cells, c), cl, state.won)),
    [state.cells, colClues, state.won],
  );

  const hasConflict =
    !state.won && (rowState.includes("impossible") || colState.includes("impossible"));

  const elapsedMs = state.won
    ? state.frozenElapsed
    : state.startTs
      ? Math.max(0, now - state.startTs)
      : 0;

  return {
    puzzle: state.puzzle,
    cells: state.cells,
    mode: state.mode,
    won: state.won,
    elapsedMs,
    rowClues,
    colClues,
    rowState,
    colState,
    hasConflict,
    paint: (r, c, value) => dispatch({ type: "apply", r, c, value, ts: Date.now() }),
    primaryValueAt: (r, c) => {
      const cur = state.cells[r][c];
      if (state.mode === "fill") return cur === 1 ? 0 : 1;
      return cur === 2 ? 0 : 2;
    },
    markValueAt: (r, c) => (state.cells[r][c] === 2 ? 0 : 2),
    setMode: (mode) => dispatch({ type: "setMode", mode }),
    reset: () => dispatch({ type: "reset" }),
    next: () => {
      const nextIndex = (state.index + 1) % puzzles.length;
      dispatch({ type: "load", index: nextIndex, puzzle: puzzles[nextIndex] });
    },
  };
}
