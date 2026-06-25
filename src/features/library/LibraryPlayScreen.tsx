"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LibraryPuzzle, ScheduleRow } from "@/lib/content/content";
import { usePuzzleGame, type PuzzleGameSnapshot } from "@/features/play/usePuzzleGame";
import { Board } from "@/features/play/Board";
import { formatTime } from "@/features/play/format";
import type { Mode } from "@/features/play/reducer";
import { recordCleared } from "@/lib/library/cleared";
import { loadLibraryStore, saveBoard, dropBoard, boardFor } from "@/lib/library/store";
import { daysSince, DAILY_EPOCH } from "@/lib/daily";
import { todayLocal } from "@/features/daily/todayDate";

const MODES: { value: Mode; label: string }[] = [
  { value: "fill", label: "Fill" },
  { value: "mark", label: "Mark" },
];

export function LibraryPlayScreen({
  puzzle,
  schedule,
  nowDate,
}: {
  puzzle: LibraryPuzzle;
  schedule?: ScheduleRow[];
  nowDate?: string;
}) {
  // Resolve the saved board client-side before mounting the game (mirrors
  // DailyScreen: usePuzzleGame's lazy init must see `initial` on first render).
  // If we mount LibraryBoard immediately, usePuzzleGame's lazy initializer runs
  // with initial=undefined; later arriving initial is ignored. So gate on ready.
  // Also compute future-daily availability in the same effect so we use the
  // player's local date — matching the wall's filtering logic exactly.
  const [ready, setReady] = useState(false);
  const [available, setAvailable] = useState(true);
  const [initial, setInitial] = useState<PuzzleGameSnapshot | undefined>(undefined);

  useEffect(() => {
    const saved = boardFor(loadLibraryStore(), puzzle.id);
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only bootstrap: read saved board once after mount before mounting the game
      setInitial({ cells: saved.cells, won: saved.completed, frozenElapsed: saved.elapsedMs });
    }
    // Check future-daily gating using the player's LOCAL date so the play page
    // and the browse wall agree in every timezone (closes the UTC-vs-local
    // play-ahead window that existed when the route used UTC).
    const todayPosition = daysSince(DAILY_EPOCH, nowDate ?? todayLocal());
    // `schedule` is left undefined (not defaulted to a fresh []) so its identity
    // is stable across renders — otherwise this effect's dep array would see a
    // new array every commit and re-run, looping with setInitial. Fall back here.
    const positionMap = new Map<string, number>(
      (schedule ?? []).map((s) => [s.puzzle_id, s.position]),
    );
    const position = positionMap.get(puzzle.id);
    const isFuture = position !== undefined && position > todayPosition;
    setAvailable(!isFuture);
    setReady(true);
  }, [puzzle.id, schedule, nowDate]);

  if (!ready) return <main className="flex flex-1 flex-col items-center px-6 py-10" />;

  if (!available) {
    return (
      <main className="flex flex-1 flex-col items-center px-6 py-10">
        <div className="rounded-2xl bg-card p-6 text-center">
          <h2 className="text-xl font-semibold text-ink">This puzzle hasn&apos;t sprouted yet 🌱</h2>
          <p className="mt-2 text-sm text-ink-soft">Come back when it&apos;s the daily.</p>
          <Link href="/library" className="mt-4 inline-block rounded-xl bg-pill px-4 py-2 text-sm font-semibold text-ink hover:opacity-90">
            Back to library
          </Link>
        </div>
      </main>
    );
  }

  return <LibraryBoard puzzle={puzzle} initial={initial} />;
}

function LibraryBoard({
  puzzle,
  initial,
}: {
  puzzle: LibraryPuzzle;
  initial: PuzzleGameSnapshot | undefined;
}) {
  const persist = (snap: PuzzleGameSnapshot) => {
    if (snap.won) {
      recordCleared(puzzle.id);
      dropBoard(puzzle.id);
      return;
    }
    const hasProgress = snap.cells.some((row) => row.some((v) => v !== 0));
    if (hasProgress) {
      saveBoard(puzzle.id, {
        cells: snap.cells,
        completed: false,
        elapsedMs: snap.frozenElapsed,
      });
    } else {
      // An empty board carries no progress — clear any prior saved entry instead
      // of persisting a blank one (matches the store's "only real progress" intent).
      dropBoard(puzzle.id);
    }
  };

  const game = usePuzzleGame([puzzle], { initial, onChange: persist });

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-fit">
        <div className="mb-5 flex items-start justify-between gap-7">
          <div className="flex flex-col gap-[3px]">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[1.3px] text-ink-soft">
              Library
            </span>
            <span className="text-[2.5rem] font-semibold leading-none text-ink">
              {puzzle.size} × {puzzle.size}
            </span>
          </div>
          <div className="inline-flex min-w-[88px] items-center rounded-pill bg-pill px-[15px] py-[9px]">
            <span className="font-mono text-xl font-semibold tabular-nums text-ink">
              {formatTime(game.elapsedMs)}
            </span>
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
            <Link
              href="/library"
              className="rounded-xl bg-pill px-4 py-2 text-sm font-semibold text-ink hover:opacity-90"
            >
              Back to library
            </Link>
          </div>
        </div>

        {game.won && (
          <div
            className="mt-4 rounded-2xl bg-card p-5"
            style={{ animation: "ng-rise .35s ease-out" }}
          >
            <h2 className="text-2xl font-semibold text-ink">Picture complete!</h2>
            <p className="mt-1 text-sm text-ink-soft">
              It&apos;s a {puzzle.name.toLowerCase()} — solved in {formatTime(game.elapsedMs)}.
            </p>
            <div className="mt-4 flex gap-[10px]">
              <Link
                href="/library"
                className="rounded-xl bg-pill px-4 py-2 text-sm font-semibold text-ink hover:opacity-90"
              >
                Back to library
              </Link>
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

        <div role="status" aria-live="polite" className="sr-only">
          {game.won ? `Picture complete — it's a ${puzzle.name.toLowerCase()}.` : ""}
        </div>
      </div>
    </main>
  );
}
