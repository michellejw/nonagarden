import Link from "next/link";
import type { CalendarModel, DayCell } from "@/lib/archive/calendar";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function isClearedLook(cell: DayCell): boolean {
  return cell.state === "cleared" || (cell.state === "today" && cell.cleared === true);
}

function Mushroom({ cell }: { cell: DayCell }) {
  if (cell.state === "gap") return null;
  // Cleared (or today-solved): full colour. In-progress: full colour. Untouched
  // past / today-unsolved: muted. Symbolic — the picture reveal lives on the detail view.
  const muted = cell.state === "uncleared" || (cell.state === "today" && !cell.cleared);
  return (
    <span aria-hidden className={`text-base leading-none ${muted ? "opacity-40 grayscale" : ""}`}>
      🍄
    </span>
  );
}

function Cell({ cell }: { cell: DayCell }) {
  if (cell.state === "pad") return <span aria-hidden />;

  const inactive = cell.state === "before-epoch" || cell.state === "future" || cell.state === "gap";
  const ring = cell.state === "today" ? "ring-2 ring-accent" : "";
  const showMushroom = !inactive || cell.state === "gap";

  const body = (
    <div
      className={`flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl ${ring} ${
        inactive ? "opacity-35" : "bg-card"
      }`}
    >
      <span className="text-xs font-semibold text-ink">{cell.day}</span>
      {showMushroom && <Mushroom cell={cell} />}
    </div>
  );

  if (inactive) return body;

  const href = cell.state === "today" ? "/" : `/archive/${cell.date}`;
  const label = `${cell.date}, ${isClearedLook(cell) ? "cleared" : "not cleared"}`;
  return (
    <Link
      href={href}
      aria-label={label}
      className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {body}
    </Link>
  );
}

export function ArchiveCalendar({ model }: { model: CalendarModel }) {
  return (
    <div className="flex flex-col gap-10">
      {model.months.map((month) => (
        <section key={`${month.year}-${month.month}`}>
          <h2 className="mb-3 text-sm font-semibold text-ink">{month.label}</h2>
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {WEEKDAYS.map((w, i) => (
              <span key={i} className="pb-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-ink-soft">
                {w}
              </span>
            ))}
            {month.cells.map((cell, i) => (
              <Cell key={i} cell={cell} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
