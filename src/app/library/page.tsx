import { LibraryScreen } from "@/features/library/LibraryScreen";
import { fetchLibraryContent } from "@/lib/content/content";

// ISR: re-fetch published content ~hourly, like the Daily. Future-daily
// filtering + cleared state are resolved on the client.
export const revalidate = 3600;

export default async function LibraryPage() {
  const { puzzles, schedule } = await fetchLibraryContent();
  return <LibraryScreen puzzles={puzzles} schedule={schedule} />;
}
