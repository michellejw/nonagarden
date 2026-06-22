// Unlinked dev/QA harness — NOT a product surface. Keeps the Slice-1 free-play
// board reachable for manual board testing until the archive (Slice #5) ships.
import { PlayScreen } from "@/features/play/PlayScreen";
import { BUILTINS } from "@/lib/puzzles/builtins";

export default function PlayHarness() {
  return <PlayScreen puzzles={BUILTINS} />;
}
