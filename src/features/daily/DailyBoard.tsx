"use client";

import { useEffect, useRef } from "react";
import type { Puzzle } from "@/lib/nonogram";
import { usePuzzleGame, type PuzzleGameSnapshot } from "@/features/play/usePuzzleGame";
import { Board } from "@/features/play/Board";
import { formatTime } from "@/features/play/format";
import type { Mode } from "@/features/play/reducer";

const MODES: { value: Mode; label: string }[] = [
  { value: "fill", label: "Fill" },
  { value: "mark", label: "Mark" },
];

export function DailyBoard({
  puzzle,
  initial,
  onChange,
  onWin,
}: {
  puzzle: Puzzle;
  initial?: PuzzleGameSnapshot;
  onChange: (snap: PuzzleGameSnapshot) => void;
  onWin: () => void;
}) {
  const game = usePuzzleGame([puzzle], { initial, onChange });

  // Fire onWin once when the board transitions to solved (idempotent upstream).
  const firedRef = useRef(false);
  useEffect(() => {
    if (game.won && !firedRef.current) {
      firedRef.current = true;
      onWin();
    }
  }, [game.won, onWin]);

  const conflictLines = [
    ...game.rowState.flatMap((s, i) => (s === "impossible" ? [`row ${i + 1}`] : [])),
    ...game.colState.flatMap((s, i) => (s === "impossible" ? [`column ${i + 1}`] : [])),
  ];
  const liveMessage = game.won
    ? `Picture complete — it's a ${game.puzzle.name.toLowerCase()}, solved in ${formatTime(game.elapsedMs)}.`
    : conflictLines.length > 0
      ? `${conflictLines.join(", ").replace(/^./, (c) => c.toUpperCase())} can't be satisfied yet.`
      : "";

  return (
    <div className="w-fit">
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
        <button
          type="button"
          onClick={game.reset}
          className="rounded-xl px-4 py-2 text-sm font-semibold text-ink-soft hover:text-ink"
        >
          Reset
        </button>
      </div>

      {game.won && (
        <div className="mt-4 rounded-2xl bg-card p-5" style={{ animation: "ng-rise .35s ease-out" }}>
          <h2 className="text-2xl font-semibold text-ink">Picture complete!</h2>
          <p className="mt-1 text-sm text-ink-soft">
            It&apos;s a {game.puzzle.name.toLowerCase()} — solved in {formatTime(game.elapsedMs)}.
          </p>
          <p className="mt-3 text-sm font-semibold text-ink">Come back tomorrow 🌱</p>
          {/* Slice #5 adds a "play a past daily" control in the space below. */}
        </div>
      )}

      <div role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </div>
    </div>
  );
}
