export type Cell = 0 | 1 | 2; // 0 empty · 1 filled · 2 marked
export type Grid = Cell[][];
export type Clue = number[]; // run-lengths; [0] for an empty line

export interface Puzzle {
  id: string;
  name: string; // hidden answer, revealed on win
  size: number; // square; ≤10 this slice
  rows: string[]; // length size; '#' filled, '.' empty
}
