"use client";

import type { Puzzle } from "@/lib/nonogram";
import { ThemeToggle } from "@/components/ThemeToggle";
import { usePuzzleGame } from "./usePuzzleGame";
import { Board } from "./Board";
import { formatTime } from "./format";
import type { Mode } from "./reducer";

const MODES: { value: Mode; label: string }[] = [
  { value: "fill", label: "Fill" },
  { value: "mark", label: "Mark" },
];

export function PlayScreen({ puzzles }: { puzzles: Puzzle[] }) {
  const game = usePuzzleGame(puzzles);

  const liveMessage = game.won
    ? `Picture complete — it's a ${game.puzzle.name.toLowerCase()}, solved in ${formatTime(game.elapsedMs)}.`
    : game.hasConflict
      ? "A highlighted clue can't be satisfied yet — something above it needs to change."
      : "";

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-fit">
        {/* header */}
        <div className="mb-5 flex items-start justify-between gap-7">
          <div className="flex flex-col gap-[3px]">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[1.3px] text-ink-soft">
              Nonogram
            </span>
            <span className="text-[2.5rem] font-semibold leading-none text-ink">
              {game.puzzle.size} × {game.puzzle.size}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex min-w-[88px] items-center gap-2 rounded-pill bg-pill px-[15px] py-[9px]">
              <span className="font-mono text-xl font-semibold tabular-nums text-ink">
                {formatTime(game.elapsedMs)}
              </span>
            </div>
            <ThemeToggle />
          </div>
        </div>

        <Board
          size={game.puzzle.size}
          cells={game.cells}
          rowClues={game.rowClues}
          colClues={game.colClues}
          rowState={game.rowState}
          colState={game.colState}
          primaryValueAt={game.primaryValueAt}
          markValueAt={game.markValueAt}
          paint={game.paint}
        />

        {/* footer */}
        <div className="mt-5 flex items-center justify-between gap-4">
          <div className="inline-flex rounded-pill bg-pill p-1" role="group" aria-label="Tool">
            {MODES.map((m) => {
              const active = game.mode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => game.setMode(m.value)}
                  className={`rounded-pill px-4 py-1.5 text-sm font-semibold transition-colors ${
                    active ? "bg-card text-ink shadow-sm" : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-[10px]">
            <button
              type="button"
              onClick={game.reset}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-ink-soft hover:text-ink"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={game.next}
              className="rounded-xl bg-pill px-4 py-2 text-sm font-semibold text-ink hover:opacity-90"
            >
              New picture
            </button>
          </div>
        </div>

        {/* conflict hint (non-color: icon + text) */}
        {game.hasConflict && !game.won && (
          <div className="mt-[14px] flex items-center gap-2 text-sm font-medium" style={{ color: "var(--mushroom-cap)" }}>
            <span aria-hidden="true">▲</span>
            A highlighted clue can&apos;t be satisfied yet — something above it needs to change.
          </div>
        )}

        {/* win card */}
        {game.won && (
          <div className="mt-4 rounded-2xl bg-card p-5" style={{ animation: "ng-rise .35s ease-out" }}>
            <h2 className="text-2xl font-semibold text-ink">Picture complete!</h2>
            <p className="mt-1 text-sm text-ink-soft">
              It&apos;s a {game.puzzle.name.toLowerCase()} — solved in {formatTime(game.elapsedMs)}.
            </p>
            <div className="mt-4 flex gap-[10px]">
              <button
                type="button"
                onClick={game.next}
                className="rounded-xl bg-pill px-4 py-2 text-sm font-semibold text-ink hover:opacity-90"
              >
                New picture
              </button>
              <button
                type="button"
                onClick={game.reset}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:opacity-90"
              >
                Play again
              </button>
            </div>
          </div>
        )}

        {/* screen-reader announcements */}
        <div role="status" aria-live="polite" className="sr-only">
          {liveMessage}
        </div>
      </div>
    </main>
  );
}
