import { PlayScreen } from "@/features/play/PlayScreen";
import { BUILTINS } from "@/lib/puzzles/builtins";

export default function Home() {
  return <PlayScreen puzzles={BUILTINS} />;
}
