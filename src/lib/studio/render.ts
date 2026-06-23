import type { Puzzle } from "../nonogram";

/**
 * Render a puzzle's solution grid as a self-contained HTML fragment:
 * a CSS-grid <div> with size×size cell <span>s. '#' → filled, else empty.
 * Pure; no engine calls.
 */
export function renderGridHtml(puzzle: Puzzle): string {
  const cells = puzzle.rows
    .map((row) =>
      row
        .split("")
        .map(
          (ch) =>
            `<span class="sg-cell ${ch === "#" ? "filled" : "empty"}"></span>`,
        )
        .join(""),
    )
    .join("");
  return `<div class="sg-grid" style="grid-template-columns:repeat(${puzzle.size},1fr)">${cells}</div>`;
}
