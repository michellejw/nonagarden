"use client";

import type { Puzzle } from "@/lib/nonogram";
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

  // Name the specific lines that currently can't be satisfied, so the spoken cue
  // matches the visual tint (and is far more useful than a generic sentence).
  const conflictLines = [
    ...game.rowState.flatMap((s, i) => (s === "impossible" ? [`row ${i + 1}`] : [])),
    ...game.colState.flatMap((s, i) => (s === "impossible" ? [`column ${i + 1}`] : [])),
  ];
  const conflictMessage =
    conflictLines.length > 0
      ? `${conflictLines.join(", ").replace(/^./, (c) => c.toUpperCase())} can't be satisfied yet.`
      : "";

  const liveMessage = game.won
    ? `Picture complete — it's a ${game.puzzle.name.toLowerCase()}, solved in ${formatTime(game.elapsedMs)}.`
    : conflictMessage;

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
            <div className="inline-flex min-w-[88px] items-center rounded-pill bg-pill px-[15px] py-[9px]">
              <span className="font-mono text-xl font-semibold tabular-nums text-ink">
                {formatTime(game.elapsedMs)}
              </span>
            </div>
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

        {/* Conflict is shown visually by the tinted clue line(s) on the board
            (ClueLine `impossible` state) and announced to screen readers via the
            live region below — no separate generic hint sentence. */}

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
