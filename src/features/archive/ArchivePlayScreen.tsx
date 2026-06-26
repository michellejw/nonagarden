// src/features/archive/ArchivePlayScreen.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Puzzle } from "@/lib/nonogram";
import { solutionOf } from "@/lib/nonogram";
import { usePuzzleGame, type PuzzleGameSnapshot } from "@/features/play/usePuzzleGame";
import { Board } from "@/features/play/Board";
import { formatTime } from "@/features/play/format";
import type { Mode } from "@/features/play/reducer";
import { recordCleared, isCleared, loadCleared } from "@/lib/library/cleared";
import { loadLibraryStore, saveBoard, dropBoard, boardFor } from "@/lib/library/store";
import { todayLocal } from "@/features/daily/todayDate";
import { dateToPuzzle, type ResolveResult } from "@/lib/archive/resolve";

const MODES: { value: Mode; label: string }[] = [
  { value: "fill", label: "Fill" },
  { value: "mark", label: "Mark" },
];

function formatLongDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  // Pure formatting — builds a Date from explicit parts; no clock is read.
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric",
  });
}

function Gate({ title, body, cta }: { title: string; body: string; cta: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="rounded-2xl bg-card p-6 text-center">
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
        <p className="mt-2 text-sm text-ink-soft">{body}</p>
        <div className="mt-4">{cta}</div>
      </div>
    </main>
  );
}

const backToArchive = (
  <Link href="/archive" className="inline-block rounded-xl bg-pill px-4 py-2 text-sm font-semibold text-ink hover:opacity-90">
    Back to archive
  </Link>
);

export function ArchivePlayScreen({
  date,
  puzzles,
  schedule,
  nowDate,
}: {
  date: string;
  puzzles: Puzzle[];
  schedule: string[];
  nowDate?: string;
}) {
  // Resolve client-side so future/today gating uses the player's LOCAL date and
  // the saved board is seen by usePuzzleGame's lazy initializer on first render.
  const [ready, setReady] = useState(false);
  const [result, setResult] = useState<ResolveResult | null>(null);
  const [cleared, setCleared] = useState(false);
  const [initial, setInitial] = useState<PuzzleGameSnapshot | undefined>(undefined);
  const [replaying, setReplaying] = useState(false);

  useEffect(() => {
    const today = nowDate ?? todayLocal();
    const res = dateToPuzzle(date, today, schedule, puzzles);
    if (res.kind === "puzzle") {
      const saved = boardFor(loadLibraryStore(), res.puzzle.id);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only bootstrap: read ledger + saved board once after mount before mounting the game.
      setCleared(isCleared(loadCleared(), res.puzzle.id));
      if (saved) setInitial({ cells: saved.cells, won: saved.completed, frozenElapsed: saved.elapsedMs });
    }
    setResult(res);
    setReady(true);
  }, [date, schedule, puzzles, nowDate]);

  if (!ready || result === null) return <main className="flex flex-1 flex-col items-center px-6 py-10" />;

  if (result.kind === "today")
    return (
      <Gate
        title="That one's today's daily"
        body="Play today's puzzle on the front door."
        cta={
          <Link href="/" className="inline-block rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:opacity-90">
            Play today's daily
          </Link>
        }
      />
    );
  if (result.kind === "future")
    return <Gate title="This day hasn't sprouted yet 🌱" body="Come back when it's the daily." cta={backToArchive} />;
  if (result.kind !== "puzzle")
    return <Gate title="No puzzle for that day" body="The garden wasn't planted here." cta={backToArchive} />;

  const puzzle = result.puzzle;
  if (cleared && !replaying)
    return <RevealView puzzle={puzzle} date={date} onReplay={() => setReplaying(true)} />;
  return <ArchiveBoard puzzle={puzzle} date={date} initial={replaying ? undefined : initial} />;
}

function RevealView({ puzzle, date, onReplay }: { puzzle: Puzzle; date: string; onReplay: () => void }) {
  const sol = solutionOf(puzzle);
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-fit text-center">
        <span className="text-[0.6875rem] font-semibold uppercase tracking-[1.3px] text-ink-soft">
          {formatLongDate(date)}
        </span>
        <div
          className="mx-auto mt-4 grid aspect-square w-48 overflow-hidden rounded-xl"
          style={{ gridTemplateColumns: `repeat(${puzzle.size}, 1fr)` }}
          aria-hidden
        >
          {sol.flatMap((row, r) =>
            row.map((filled, c) => <span key={`${r}-${c}`} className={filled ? "bg-ink" : "bg-card"} />),
          )}
        </div>
        <h2 className="mt-4 text-2xl font-semibold text-ink">{puzzle.name}</h2>
        <div className="mt-5 flex justify-center gap-[10px]">
          {backToArchive}
          <button
            type="button"
            onClick={onReplay}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:opacity-90"
          >
            Play again
          </button>
        </div>
      </div>
    </main>
  );
}

function ArchiveBoard({ puzzle, date, initial }: { puzzle: Puzzle; date: string; initial: PuzzleGameSnapshot | undefined }) {
  const persist = (snap: PuzzleGameSnapshot) => {
    if (snap.won) {
      recordCleared(puzzle.id); // global ledger; never touches streak
      dropBoard(puzzle.id);
      return;
    }
    const hasProgress = snap.cells.some((row) => row.some((v) => v !== 0));
    if (hasProgress) {
      saveBoard(puzzle.id, { cells: snap.cells, completed: false, elapsedMs: snap.frozenElapsed });
    } else {
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
              {formatLongDate(date)}
            </span>
            <span className="text-[2.5rem] font-semibold leading-none text-ink">
              {puzzle.size} × {puzzle.size}
            </span>
          </div>
          <div className="inline-flex min-w-[88px] items-center rounded-pill bg-pill px-[15px] py-[9px]">
            <span className="font-mono text-xl font-semibold tabular-nums text-ink">{formatTime(game.elapsedMs)}</span>
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
            <button type="button" onClick={game.reset} className="rounded-xl px-4 py-2 text-sm font-semibold text-ink-soft hover:text-ink">
              Reset
            </button>
            <Link href="/archive" className="rounded-xl bg-pill px-4 py-2 text-sm font-semibold text-ink hover:opacity-90">
              Back to archive
            </Link>
          </div>
        </div>

        {game.won && (
          <div className="mt-4 rounded-2xl bg-card p-5" style={{ animation: "ng-rise .35s ease-out" }}>
            <h2 className="text-2xl font-semibold text-ink">Picture complete!</h2>
            <p className="mt-1 text-sm text-ink-soft">
              It&apos;s a {puzzle.name.toLowerCase()} — solved in {formatTime(game.elapsedMs)}.
            </p>
            <div className="mt-4 flex gap-[10px]">
              <Link href="/archive" className="rounded-xl bg-pill px-4 py-2 text-sm font-semibold text-ink hover:opacity-90">
                Back to archive
              </Link>
              <button type="button" onClick={game.reset} className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:opacity-90">
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
