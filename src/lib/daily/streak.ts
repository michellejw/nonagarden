import { daysSince } from "./schedule";

export interface StreakState {
  current: number;
  lastCompleted: string | null; // "YYYY-MM-DD"
}

// Pure transition: completing `date` given prior state. Calendar-strict.
export function completeDaily(prev: StreakState, date: string): StreakState {
  if (prev.lastCompleted === date) return prev; // idempotent
  if (prev.lastCompleted && daysSince(prev.lastCompleted, date) === 1) {
    return { current: prev.current + 1, lastCompleted: date };
  }
  return { current: 1, lastCompleted: date }; // first ever, or after a gap
}

// Display-only: the streak as it reads "today" without mutating stored state.
// Breaks to 0 as soon as a calendar day is missed.
export function currentStreakAsOf(state: StreakState, today: string): number {
  if (!state.lastCompleted) return 0;
  const gap = daysSince(state.lastCompleted, today);
  return gap === 0 || gap === 1 ? state.current : 0;
}
