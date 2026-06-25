"use client";

import { useEffect, useMemo, useState } from "react";
import {
  mapLibraryContent,
  type LibraryPuzzleRow,
  type ScheduleRow,
  type LibraryPuzzle,
} from "@/lib/content/content";
import { loadCleared, isCleared, type ClearedStore } from "@/lib/library/cleared";
import {
  loadLibraryStore,
  boardFor,
  defaultLibraryStore,
  type LibraryStore,
} from "@/lib/library/store";
import { daysSince, DAILY_EPOCH } from "@/lib/daily";
import { todayLocal } from "@/features/daily/todayDate";
import { PuzzleTile } from "./PuzzleTile";

export function LibraryScreen({
  puzzles,
  schedule,
}: {
  puzzles: LibraryPuzzleRow[];
  schedule: ScheduleRow[];
}) {
  // Client-only: local date (timezone) + ledger (localStorage). Null until mounted
  // so SSR/first paint don't assume a position or read storage.
  const [ready, setReady] = useState(false);
  const [todayPosition, setTodayPosition] = useState(0);
  const [cleared, setCleared] = useState<ClearedStore>({ version: 1, ids: [] });
  const [boards, setBoards] = useState<LibraryStore>(defaultLibraryStore);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only bootstrap: resolve local date + ledger + in-progress boards once after mount (SSR can't know timezone/localStorage).
    setTodayPosition(daysSince(DAILY_EPOCH, todayLocal()));
    setCleared(loadCleared());
    setBoards(loadLibraryStore());
    setReady(true);
  }, []);

  const visible: LibraryPuzzle[] = useMemo(
    () => (ready ? mapLibraryContent(puzzles, schedule, todayPosition) : []),
    [ready, puzzles, schedule, todayPosition],
  );

  const groups = useMemo(() => {
    const bySize = new Map<number, LibraryPuzzle[]>();
    for (const p of visible) {
      const arr = bySize.get(p.size) ?? [];
      arr.push(p);
      bySize.set(p.size, arr);
    }
    return [...bySize.entries()].sort((a, b) => a[0] - b[0]);
  }, [visible]);

  const clearedCount = visible.filter((p) => isCleared(cleared, p.id)).length;

  if (!ready) return <main className="flex flex-1 flex-col items-center px-6 py-10" />;

  if (visible.length === 0) {
    return (
      <main className="flex flex-1 flex-col items-center px-6 py-10">
        <div className="rounded-2xl bg-card p-6 text-center">
          <h2 className="text-xl font-semibold text-ink">The library&apos;s still growing 🌱</h2>
          <p className="mt-2 text-sm text-ink-soft">Check back soon for more puzzles.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-full max-w-5xl">
        <div className="mb-8 flex items-baseline justify-between border-b border-border pb-4">
          <h1 className="text-2xl font-semibold text-ink">Library</h1>
          <span className="text-sm font-semibold text-ink-soft">
            {clearedCount} / {visible.length} cleared
          </span>
        </div>
        {groups.map(([size, items]) => (
          <section key={size} className="mb-10">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-soft">
              {size} × {size}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {items.map((p) => {
                const done = isCleared(cleared, p.id);
                return (
                  <PuzzleTile
                    key={p.id}
                    puzzle={p}
                    cleared={done}
                    inProgress={!done && boardFor(boards, p.id) !== undefined}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
