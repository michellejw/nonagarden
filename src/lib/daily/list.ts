// The daily schedule. DAILY_LIST is APPEND-ONLY: dailyFor() maps day N (since
// DAILY_EPOCH) to DAILY_LIST[N], so inserting or reordering any entry
// retroactively changes past dailies (breaking streaks + the future archive).
// To add content: append ids to the END only. Every id must exist in BUILTINS.
export const DAILY_EPOCH = "2026-06-22"; // day 0 — the first-ever daily

export const DAILY_LIST: readonly string[] = [
  "sprout",
  "diamond",
  "toadstool",
  "heart",
  "cottage",
  // Task 4: verified puzzles appended below (unique + line-solvable)
  "mushroom",
  "acorn",
  "bee",
  "fish",
  "star",
  "cup",
  "moon",
  "key",
  "flower",
  "owl",
  "teapot",
];
