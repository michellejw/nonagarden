import type { Cell, Grid } from "./types";

export function emptyGrid(size: number): Grid {
  return Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 0 as Cell),
  );
}

export function column<T>(grid: ReadonlyArray<ReadonlyArray<T>>, c: number): T[] {
  return grid.map((row) => row[c]);
}
