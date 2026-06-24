import { notFound } from "next/navigation";
import { LibraryPlayScreen } from "@/features/library/LibraryPlayScreen";
import { fetchLibraryContent, mapLibraryContent } from "@/lib/content/content";
import { daysSince, DAILY_EPOCH } from "@/lib/daily";

export const revalidate = 3600;

export default async function LibraryPlayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { puzzles, schedule } = await fetchLibraryContent();
  // Server can't know the player's timezone; use a UTC-based today for the
  // membership 404. The exact local-day edge is cosmetic — a puzzle that is
  // "tomorrow" in one timezone is still excluded within ~a day. Client screens
  // use local date for display/filtering.
  const todayPosition = daysSince(DAILY_EPOCH, new Date().toISOString().slice(0, 10));
  const puzzle = mapLibraryContent(puzzles, schedule, todayPosition).find(
    (p) => p.slug === slug,
  );
  if (!puzzle) notFound();
  return <LibraryPlayScreen puzzle={puzzle} />;
}
