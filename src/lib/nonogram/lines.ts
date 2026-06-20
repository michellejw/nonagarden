import type { Cell, Clue } from "./types";

export function lineSatisfied(marks: ReadonlyArray<Cell>, clue: Clue): boolean {
  const runs: number[] = [];
  let r = 0;
  for (const v of marks) {
    if (v === 1) r++;
    else if (r) {
      runs.push(r);
      r = 0;
    }
  }
  if (r) runs.push(r);
  const rr = runs.length ? runs : [0];
  if (rr.length !== clue.length) return false;
  for (let i = 0; i < clue.length; i++) if (rr[i] !== clue[i]) return false;
  return true;
}

// Memoized DP: can `clue` still be satisfied given marks (1 filled, 2 known-empty, 0 unknown)?
// NOTE: key packs i*64+j — valid for line length < 64 (≤10 this slice). Revisit for big grids.
export function lineFeasible(marks: ReadonlyArray<Cell>, clue: Clue): boolean {
  const n = marks.length;
  if (clue.length === 1 && clue[0] === 0) return !marks.includes(1);
  const m = clue.length;
  const memo = new Map<number, boolean>();
  const go = (i: number, j: number): boolean => {
    if (j === m) {
      for (let k = i; k < n; k++) if (marks[k] === 1) return false;
      return true;
    }
    if (i >= n) return false;
    const key = i * 64 + j;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    let res = false;
    if (marks[i] !== 1) {
      if (go(i + 1, j)) res = true;
    }
    if (!res) {
      const len = clue[j];
      if (i + len <= n) {
        let ok = true;
        for (let k = i; k < i + len; k++)
          if (marks[k] === 2) {
            ok = false;
            break;
          }
        if (ok && i + len < n && marks[i + len] === 1) ok = false;
        if (ok) {
          const ni = i + len + (i + len < n ? 1 : 0);
          if (go(ni, j + 1)) res = true;
        }
      }
    }
    memo.set(key, res);
    return res;
  };
  return go(0, 0);
}

export type LineState = "normal" | "satisfied" | "impossible";

export function lineState(
  marks: ReadonlyArray<Cell>,
  clue: Clue,
  won = false,
): LineState {
  if (!lineFeasible(marks, clue)) return "impossible";
  if (won || lineSatisfied(marks, clue)) return "satisfied";
  return "normal";
}
