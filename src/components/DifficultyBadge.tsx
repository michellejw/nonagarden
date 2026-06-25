import type { Difficulty } from "@/lib/nonogram";

// Cozy forest progression: forager (easy) → woodlander → mycologist (hard).
const STYLES: Record<Difficulty, string> = {
  forager: "bg-emerald-100 text-emerald-800",
  woodlander: "bg-amber-100 text-amber-800",
  mycologist: "bg-rose-100 text-rose-800",
};

const LABELS: Record<Difficulty, string> = {
  forager: "Forager",
  woodlander: "Woodlander",
  mycologist: "Mycologist",
};

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[0.6875rem] font-semibold ${STYLES[difficulty]}`}
    >
      {LABELS[difficulty]}
    </span>
  );
}
