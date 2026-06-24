"use client";

import { useEffect, useMemo, useState } from "react";
import {
  dailyFor,
  completeDaily,
  currentStreakAsOf,
  loadStore,
  saveStore,
  defaultStore,
  type DailyStore,
} from "@/lib/daily";
import type { Puzzle } from "@/lib/nonogram";
import { todayLocal } from "./todayDate";
import { DailyBoard } from "./DailyBoard";
import type { PuzzleGameSnapshot } from "@/features/play/usePuzzleGame";

function formatLongDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  // Pure: builds a Date from the given date string for formatting only — no clock is read here.
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function DailyScreen({
  puzzles,
  schedule,
  nowDate,
}: {
  puzzles: Puzzle[];
  schedule: readonly string[];
  nowDate?: string;
}) {
  // Always start null: DailyBoard must not mount until BOTH today and store are
  // loaded from the client (one useEffect, one setState call). This prevents a
  // race where DailyBoard mounts with store=defaultStore (no saved data) and
  // usePuzzleGame's lazy initializer ignores the later-arriving `initial` prop.
  const [today, setToday] = useState<string | null>(null);
  const [store, setStore] = useState<DailyStore>(defaultStore);

  // Resolve clock + storage only on the client, after mount (avoids hydration
  // mismatch: the server can't know the player's local date or localStorage).
  useEffect(() => {
    const loaded = loadStore();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: client-only bootstrap reads localStorage + local clock once after mount; DailyBoard must not mount until both are resolved (avoids usePuzzleGame lazy-init race with stale defaultStore). Both setStore+setToday land in a single React 18 batched re-render.
    setStore(loaded);
    setToday(nowDate ?? todayLocal());
  }, [nowDate]);

  const byId = useMemo(() => new Map(puzzles.map((p) => [p.id, p])), [puzzles]);
  const result = useMemo(
    () => (today ? dailyFor(today, schedule) : null),
    [today, schedule],
  );
  const streak = today ? currentStreakAsOf(store.streak, today) : 0;

  if (!today || !result) return <DailyShell streak={0} dateLabel="" />; // skeleton

  if (result.kind === "puzzle") {
    const puzzle = byId.get(result.puzzleId);
    if (puzzle) {
      const saved =
        store.today && store.today.date === today && store.today.puzzleId === puzzle.id
          ? { cells: store.today.cells, won: store.today.completed, frozenElapsed: store.today.elapsedMs }
          : undefined;

      const persist = (snap: PuzzleGameSnapshot) =>
        setStore((s) => {
          const next: DailyStore = {
            ...s,
            today: {
              date: today,
              puzzleId: puzzle.id,
              cells: snap.cells,
              completed: snap.won,
              elapsedMs: snap.frozenElapsed,
            },
          };
          saveStore(next);
          return next;
        });

      const onWin = () =>
        setStore((s) => {
          const next: DailyStore = { ...s, streak: completeDaily(s.streak, today) };
          saveStore(next);
          return next;
        });

      return (
        <DailyShell streak={streak} dateLabel={formatLongDate(today)}>
          <DailyBoard puzzle={puzzle} initial={saved} onChange={persist} onWin={onWin} />
        </DailyShell>
      );
    }
  }

  // none / before-epoch / missing puzzle → caught-up copy.
  return (
    <DailyShell streak={streak} dateLabel={formatLongDate(today)}>
      <div className="rounded-2xl bg-card p-6 text-center">
        <h2 className="text-xl font-semibold text-ink">You&apos;re all caught up</h2>
        <p className="mt-2 text-sm text-ink-soft">No daily scheduled yet — come back soon 🌱</p>
      </div>
    </DailyShell>
  );
}

function DailyShell({
  streak,
  dateLabel,
  children,
}: {
  streak: number;
  dateLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-fit">
        <div className="mb-5 flex items-start justify-between gap-7">
          <div className="flex flex-col gap-[3px]">
            <span className="text-[0.6875rem] font-semibold uppercase tracking-[1.3px] text-ink-soft">
              Daily
            </span>
            <span className="text-[1.75rem] font-semibold leading-none text-ink">
              {dateLabel || " "}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {streak > 0 && (
              <div
                className="inline-flex items-center rounded-pill bg-pill px-[15px] py-[9px] text-sm font-semibold text-ink"
                aria-label={`Current streak: ${streak} ${streak === 1 ? "day" : "days"}`}
              >
                🔥 {streak} day{streak === 1 ? "" : "s"} streak
              </div>
            )}
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
