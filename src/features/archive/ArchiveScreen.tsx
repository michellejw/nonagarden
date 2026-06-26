"use client";

import { useEffect, useState } from "react";
import { DAILY_EPOCH, currentStreakAsOf, loadStore } from "@/lib/daily";
import { loadCleared } from "@/lib/library/cleared";
import { loadLibraryStore } from "@/lib/library/store";
import { todayLocal } from "@/features/daily/todayDate";
import { buildCalendar } from "@/lib/archive/calendar";
import { ArchiveCalendar } from "./ArchiveCalendar";

export function ArchiveScreen({
  schedule,
  nowDate,
}: {
  schedule: string[];
  nowDate?: string;
}) {
  // Client-only: local date + ledgers + streak resolved once after mount (SSR
  // can't know the player's timezone or localStorage).
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState("");
  const [clearedIds, setClearedIds] = useState<Set<string>>(new Set());
  const [inProgressIds, setInProgressIds] = useState<Set<string>>(new Set());
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const t = nowDate ?? todayLocal();
    const cleared = loadCleared();
    const boards = loadLibraryStore();
    const daily = loadStore();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only bootstrap: local date + ledgers read once after mount.
    setToday(t);
    setClearedIds(new Set(cleared.ids));
    setInProgressIds(new Set(Object.keys(boards.boards)));
    setStreak(currentStreakAsOf(daily.streak, t));
    setReady(true);
  }, [nowDate]);

  if (!ready) return <main className="flex flex-1 flex-col items-center px-6 py-10" />;

  const model = buildCalendar({ epoch: DAILY_EPOCH, today, schedule, clearedIds, inProgressIds });

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-10">
      <div className="w-full max-w-2xl">
        <div className="mb-8 flex items-baseline justify-between border-b border-border pb-4">
          <h1 className="text-2xl font-semibold text-ink">Archive</h1>
          {streak > 0 && (
            <span className="text-sm font-semibold text-ink-soft">
              {streak === 1 ? "1 day streak" : `${streak} day streak`}
            </span>
          )}
        </div>
        <ArchiveCalendar model={model} />
      </div>
    </main>
  );
}
