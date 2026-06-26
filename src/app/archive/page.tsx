import { ArchiveScreen } from "@/features/archive/ArchiveScreen";
import { fetchDailyContent } from "@/lib/content/content";

// ISR: re-fetch published content ~hourly, like the Daily. Local date + cleared
// state are resolved on the client.
export const revalidate = 3600;

export default async function ArchivePage() {
  const { schedule } = await fetchDailyContent();
  return <ArchiveScreen schedule={schedule} />;
}
