import type { Cell, Grid, Puzzle } from "@/lib/nonogram";
import { emptyGrid, checkWin } from "@/lib/nonogram";

export type Mode = "fill" | "mark";

export interface PlayState {
  index: number;
  puzzle: Puzzle;
  cells: Grid;
  mode: Mode;
  startTs: number | null;
  won: boolean;
  frozenElapsed: number;
}

export type PlayAction =
  | { type: "apply"; r: number; c: number; value: Cell; ts: number }
  | { type: "setMode"; mode: Mode }
  | { type: "reset" }
  | { type: "load"; index: number; puzzle: Puzzle };

export function initState(puzzles: Puzzle[]): PlayState {
  const puzzle = puzzles[0];
  return {
    index: 0,
    puzzle,
    cells: emptyGrid(puzzle.size),
    mode: "fill",
    startTs: null,
    won: false,
    frozenElapsed: 0,
  };
}

export function seedState(
  puzzle: Puzzle,
  saved: { cells: Grid; won: boolean; frozenElapsed: number },
): PlayState {
  return {
    index: 0,
    puzzle,
    cells: saved.cells.map((row) => row.slice()) as Grid,
    mode: "fill",
    startTs: null,
    won: saved.won,
    frozenElapsed: saved.frozenElapsed,
  };
}

export function reducer(state: PlayState, action: PlayAction): PlayState {
  switch (action.type) {
    case "apply": {
      if (state.won) return state;
      const { r, c, value, ts } = action;
      if (state.cells[r][c] === value) return state;
      const cells = state.cells.map((row) => row.slice()) as Grid;
      cells[r][c] = value;
      const startTs = state.startTs ?? ts;
      const won = checkWin(cells, state.puzzle);
      return {
        ...state,
        cells,
        startTs,
        won,
        frozenElapsed: won ? ts - startTs : state.frozenElapsed,
      };
    }
    case "setMode":
      return { ...state, mode: action.mode };
    case "reset":
      return {
        ...state,
        cells: emptyGrid(state.puzzle.size),
        startTs: null,
        won: false,
        frozenElapsed: 0,
      };
    case "load":
      return {
        index: action.index,
        puzzle: action.puzzle,
        cells: emptyGrid(action.puzzle.size),
        mode: state.mode,
        startTs: null,
        won: false,
        frozenElapsed: 0,
      };
  }
}
