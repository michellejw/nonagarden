import { DailyScreen } from "@/features/daily/DailyScreen";
import { fetchDailyContent } from "@/lib/content/content";

// ISR: re-fetch DB content ~hourly. New published puzzles appear without a
// redeploy. Past-stability/determinism come from the append-only schedule +
// dailyFor, independent of this cache.
export const revalidate = 3600;

export default async function Home() {
  const { puzzles, schedule } = await fetchDailyContent();
  return <DailyScreen puzzles={puzzles} schedule={schedule} />;
}
