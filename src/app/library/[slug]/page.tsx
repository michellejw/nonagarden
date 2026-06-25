import { notFound } from "next/navigation";
import { LibraryPlayScreen } from "@/features/library/LibraryPlayScreen";
import { fetchLibraryContent } from "@/lib/content/content";

export const revalidate = 3600;

export default async function LibraryPlayPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { puzzles, schedule } = await fetchLibraryContent();
  // Find the puzzle by slug among ALL published puzzles — no future-daily
  // filtering here. Future-daily exclusion is enforced client-side by
  // LibraryPlayScreen using the player's local date, so the wall and play
  // page agree in every timezone.
  const row = puzzles.find((p) => p.slug === slug);
  if (!row) notFound();
  const puzzle = { id: row.id, name: row.name, size: row.size, rows: row.rows, slug: row.slug, difficulty: row.difficulty };
  return <LibraryPlayScreen puzzle={puzzle} schedule={schedule} />;
}
