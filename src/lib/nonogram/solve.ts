import type { Cell, Clue } from "./types";
import { lineFeasible } from "./lines";

// Every placement of a line, as an array of 1 (filled) / 2 (empty), length N.
export function arrangements(clue: Clue, N: number): number[][] {
  if (clue.length === 1 && clue[0] === 0) return [new Array(N).fill(2)];
  const blocks = clue;
  const k = blocks.length;
  const out: number[][] = [];
  const suffix = (idx: number) => {
    let s = 0;
    for (let i = idx; i < k; i++) s += blocks[i];
    return s + (k - 1 - idx);
  };
  const place = (idx: number, pos: number, arr: number[]) => {
    if (idx === k) {
      const a = arr.slice();
      for (let i = pos; i < N; i++) a[i] = 2;
      out.push(a);
      return;
    }
    const maxStart = N - suffix(idx);
    for (let start = pos; start <= maxStart; start++) {
      const a = arr.slice();
      for (let i = pos; i < start; i++) a[i] = 2;
      for (let i = start; i < start + blocks[idx]; i++) a[i] = 1;
      let next = start + blocks[idx];
      if (next < N) {
        a[next] = 2;
        next++;
      }
      place(idx + 1, next, a);
    }
  };
  place(0, 0, new Array(N).fill(0));
  return out;
}

export type CountResult =
  | { status: "ok"; count: number }
  | { status: "unknown" };

// DFS placing one row-arrangement at a time, pruning per-column with lineFeasible.
// Counts up to `cap` full solutions; a node budget caps runaway cases → "unknown".
export function countSolutions(
  rowClues: Clue[],
  colClues: Clue[],
  N: number,
  cap = 2,
): CountResult {
  const rowOpts = rowClues.map((cl) => arrangements(cl, N));
  for (const o of rowOpts) if (o.length === 0) return { status: "ok", count: 0 };
  const grid: number[][] = [];
  let count = 0;
  let nodes = 0;
  let aborted = false;
  const BUDGET = 400000;
  const colOK = (upto: number): boolean => {
    for (let c = 0; c < N; c++) {
      const marks: Cell[] = new Array(N).fill(0);
      for (let r = 0; r <= upto; r++) marks[r] = grid[r][c] as Cell;
      if (!lineFeasible(marks, colClues[c])) return false;
    }
    return true;
  };
  const dfs = (r: number) => {
    if (aborted || count >= cap) return;
    if (r === N) {
      count++;
      return;
    }
    for (const opt of rowOpts[r]) {
      if (nodes++ > BUDGET) {
        aborted = true;
        return;
      }
      grid[r] = opt;
      if (colOK(r)) dfs(r + 1);
      if (aborted || count >= cap) {
        grid.length = r;
        return;
      }
    }
    grid.length = r;
  };
  dfs(0);
  return aborted ? { status: "unknown" } : { status: "ok", count };
}

// ---- Line-solver (pure constraint propagation, no guessing) ----
// Internal grid representation: 0 unknown · 1 filled · 2 empty (matches `arrangements`).

function consistent(a: number[], marks: number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (marks[i] === 1 && a[i] !== 1) return false;
    if (marks[i] === 2 && a[i] !== 2) return false;
  }
  return true;
}

// For one line, fill every cell that ALL consistent arrangements agree on.
function lineForced(marks: number[], clue: Clue, N: number): number[] {
  const opts = arrangements(clue, N);
  if (opts.length > 60000) return marks; // too many to enumerate cheaply
  const cons = opts.filter((a) => consistent(a, marks));
  if (cons.length === 0) return marks; // contradiction; leave as-is
  const res = marks.slice();
  for (let i = 0; i < N; i++) {
    if (res[i] === 0) {
      const v = cons[0][i];
      let all = true;
      for (let k = 1; k < cons.length; k++)
        if (cons[k][i] !== v) {
          all = false;
          break;
        }
      if (all) res[i] = v;
    }
  }
  return res;
}

export interface LineSolveResult {
  solved: boolean; // grid fully determined by line logic alone (⟹ unique)
  rounds: number; // propagation rounds to fixpoint
}

export function lineSolve(rowClues: Clue[], colClues: Clue[], N: number): LineSolveResult {
  const known: number[][] = Array.from({ length: N }, () => new Array(N).fill(0));
  let rounds = 0;
  let changed = true;
  while (changed && rounds < 80) {
    changed = false;
    rounds++;
    for (let r = 0; r < N; r++) {
      const nm = lineForced(known[r], rowClues[r], N);
      for (let c = 0; c < N; c++)
        if (nm[c] !== known[r][c]) {
          known[r][c] = nm[c];
          changed = true;
        }
    }
    for (let c = 0; c < N; c++) {
      const cm = known.map((row) => row[c]);
      const nm = lineForced(cm, colClues[c], N);
      for (let r = 0; r < N; r++)
        if (nm[r] !== known[r][c]) {
          known[r][c] = nm[r];
          changed = true;
        }
    }
  }
  let solved = true;
  for (let r = 0; r < N && solved; r++)
    for (let c = 0; c < N; c++)
      if (known[r][c] === 0) {
        solved = false;
        break;
      }
  return { solved, rounds };
}

export type Difficulty = "forager" | "woodlander" | "mycologist";

export function difficultyOf(rowClues: Clue[], colClues: Clue[], N: number): Difficulty {
  const { solved, rounds } = lineSolve(rowClues, colClues, N);
  if (!solved) return "mycologist"; // requires guessing
  if (rounds <= 2) return "forager";
  if (rounds <= 5) return "woodlander";
  return "mycologist";
}
