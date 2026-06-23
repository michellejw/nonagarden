import { tryGrade } from "./grade";
import { renderGridHtml } from "./render";
import type { Difficulty, Puzzle } from "../nonogram";

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

export interface GalleryItem {
  puzzle: Puzzle;
  valid: boolean;
  difficulty?: Difficulty;
  reason?: string;
}

/** Grade every candidate (never throws) into reviewable gallery items. */
export function gradeCandidates(candidates: Puzzle[]): GalleryItem[] {
  return candidates.map((puzzle) => {
    const g = tryGrade(puzzle);
    return g.ok
      ? { puzzle, valid: true, difficulty: g.difficulty }
      : { puzzle, valid: false, reason: g.reason };
  });
}

const STYLE = `
  body { font-family: ui-rounded, "Fredoka", system-ui, sans-serif; background: #faf7f0; color: #2c2a26; margin: 2rem; }
  h1 { font-size: 1.4rem; }
  .gallery { display: flex; flex-wrap: wrap; gap: 1.25rem; }
  .card { background: #fff; border: 1px solid #e7e0d4; border-radius: 14px; padding: 0.9rem; width: max-content; }
  .card.is-invalid { border-color: #d8a39a; background: #fdf3f1; }
  .sg-grid { display: inline-grid; gap: 1px; background: #cfc6b6; border: 1px solid #cfc6b6; }
  .sg-cell { width: 18px; height: 18px; }
  .sg-cell.filled { background: #4a4540; }
  .sg-cell.empty { background: #f4efe6; }
  figcaption { margin-top: 0.5rem; font-size: 0.85rem; }
  .badge { display: inline-block; margin-left: 0.35rem; padding: 0.05rem 0.4rem; border-radius: 999px; font-size: 0.72rem; background: #ece4d6; }
  .badge.invalid { background: #d8a39a; color: #fff; }
  .reason { margin: 0.35rem 0 0; font-size: 0.78rem; color: #9c5a4d; }
`;

export function buildGalleryHtml(
  items: GalleryItem[],
  title = "Nonagarden — candidates",
): string {
  const validCount = items.filter((i) => i.valid).length;
  const cards = items
    .map((it) => {
      const badge = it.valid
        ? `<span class="badge ${it.difficulty}">${it.difficulty}</span>`
        : `<span class="badge invalid">invalid</span>`;
      const note = it.valid ? "" : `<p class="reason">${esc(it.reason ?? "")}</p>`;
      return `<figure class="card ${it.valid ? "" : "is-invalid"}">
  ${renderGridHtml(it.puzzle)}
  <figcaption><strong>${esc(it.puzzle.name)}</strong> · ${it.puzzle.size}×${it.puzzle.size} · <code>${esc(it.puzzle.id)}</code> ${badge}${note}</figcaption>
</figure>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${title}</title><style>${STYLE}</style></head>
<body>
<h1>${title}</h1>
<p>${validCount}/${items.length} valid</p>
<main class="gallery">${cards}</main>
</body>
</html>`;
}
