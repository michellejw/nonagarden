import Link from "next/link";
import { solutionOf } from "@/lib/nonogram";
import type { LibraryPuzzle } from "@/lib/content/content";
import { DifficultyBadge } from "@/components/DifficultyBadge";

function Thumbnail({ puzzle }: { puzzle: LibraryPuzzle }) {
  const sol = solutionOf(puzzle);
  return (
    <div
      data-testid="tile-thumbnail"
      className="grid aspect-square w-full overflow-hidden rounded-lg"
      style={{ gridTemplateColumns: `repeat(${puzzle.size}, 1fr)` }}
      aria-hidden
    >
      {sol.flatMap((row, r) =>
        row.map((filled, c) => (
          <span
            key={`${r}-${c}`}
            className={filled ? "bg-ink" : "bg-card"}
          />
        )),
      )}
    </div>
  );
}

export function PuzzleTile({
  puzzle,
  cleared,
}: {
  puzzle: LibraryPuzzle;
  cleared: boolean;
}) {
  return (
    <Link
      href={`/library/${puzzle.slug}`}
      className="flex flex-col gap-2 rounded-2xl bg-card p-3 transition-transform hover:-translate-y-0.5"
    >
      <div className="aspect-square w-full overflow-hidden rounded-lg bg-pill">
        {cleared ? (
          <Thumbnail puzzle={puzzle} />
        ) : (
          <div className="flex h-full items-center justify-center text-2xl text-ink-soft" aria-hidden>
            🍄
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-ink">{puzzle.name}</span>
        <span className="text-xs text-ink-soft">
          {puzzle.size} × {puzzle.size}
        </span>
      </div>
      <DifficultyBadge difficulty={puzzle.difficulty} />
    </Link>
  );
}
