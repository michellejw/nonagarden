// src/app/archive/[date]/page.tsx
import { ArchivePlayScreen } from "@/features/archive/ArchivePlayScreen";
import { fetchDailyContent } from "@/lib/content/content";

export const revalidate = 3600;

export default async function ArchivePlayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  // Pass ALL published content; the client resolves date→puzzle with its local
  // date so future/today gating agrees in every timezone (mirrors the daily).
  const { puzzles, schedule } = await fetchDailyContent();
  return <ArchivePlayScreen date={date} puzzles={puzzles} schedule={schedule} />;
}
