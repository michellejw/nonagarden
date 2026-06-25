import Link from "next/link";
import { solutionOf } from "@/lib/nonogram";
import type { LibraryPuzzle } from "@/lib/content/content";
import { DifficultyBadge } from "@/components/DifficultyBadge";

function Thumbnail({ puzzle }: { puzzle: LibraryPuzzle }) {
  const sol = solutionOf(puzzle);
  return (
    <div
      data-testid="tile-thumbnail"
      className="grid aspect-square w-3/4 overflow-hidden rounded-md"
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
  inProgress = false,
}: {
  puzzle: LibraryPuzzle;
  cleared: boolean;
  inProgress?: boolean;
}) {
  // The picture's identity is the reward: name and image stay hidden until
  // solved. Before then a mushroom conveys state — a muted/gray one when
  // untouched, a full-colour one once you've started, the revealed picture
  // when solved. The art sits on the app's "covered tile" ground so every
  // state shares one frame; the footer keeps a fixed shape so rows stay even.
  return (
    <Link
      href={`/library/${puzzle.slug}`}
      className="group flex flex-col gap-2.5 rounded-2xl bg-card p-2.5 transition-transform hover:-translate-y-0.5"
    >
      <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-tile-covered">
        {cleared ? (
          <Thumbnail puzzle={puzzle} />
        ) : (
          <span
            className={`text-6xl leading-none ${inProgress ? "" : "grayscale opacity-50"}`}
            aria-hidden
          >
            🍄
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5 px-0.5">
        <span className="min-h-5 truncate text-sm font-semibold text-ink">
          {cleared ? (
            puzzle.name
          ) : (
            <span className="text-ink-soft">{inProgress ? "In progress" : "Not started"}</span>
          )}
        </span>
        <DifficultyBadge difficulty={puzzle.difficulty} />
      </div>
    </Link>
  );
}
