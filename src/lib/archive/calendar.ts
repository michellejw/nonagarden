import { daysSince } from "@/lib/daily";

export type CellState =
  | "today" // today's date — routes to the front door (live daily)
  | "cleared" // past, scheduled, solved
  | "in-progress" // past, scheduled, has a saved board, not solved
  | "uncleared" // past, scheduled, untouched
  | "gap" // past, scheduled slot empty / beyond the list
  | "future" // date after today
  | "before-epoch" // date before the daily run started
  | "pad"; // leading weekday filler, no date

export interface DayCell {
  date: string | null; // "YYYY-MM-DD"; null only for "pad"
  day: number | null; // 1..31; null only for "pad"
  state: CellState;
  puzzleId?: string; // present for today/cleared/in-progress/uncleared
  cleared?: boolean; // for "today": also solved? (colour mushroom + ring)
}

export interface MonthGroup {
  year: number;
  month: number; // 1..12
  label: string; // "June 2026"
  cells: DayCell[]; // leading pad cells, then one per day-of-month
}

export interface CalendarModel {
  months: MonthGroup[]; // most-recent month first
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Deterministic from explicit args — no clock is read.
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate(); // day 0 of next month = last day
}
function firstWeekday(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay(); // 0=Sun .. 6=Sat
}
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function classifyDay(
  date: string,
  day: number,
  epoch: string,
  today: string,
  schedule: readonly string[],
  clearedIds: ReadonlySet<string>,
  inProgressIds: ReadonlySet<string>,
): DayCell {
  if (date < epoch) return { date, day, state: "before-epoch" };
  if (date > today) return { date, day, state: "future" };

  const position = daysSince(epoch, date);
  const id = position < schedule.length ? schedule[position] : "";

  if (date === today) {
    if (!id) return { date, day, state: "today" };
    return { date, day, state: "today", puzzleId: id, cleared: clearedIds.has(id) };
  }
  if (!id) return { date, day, state: "gap" };
  if (clearedIds.has(id)) return { date, day, state: "cleared", puzzleId: id };
  if (inProgressIds.has(id)) return { date, day, state: "in-progress", puzzleId: id };
  return { date, day, state: "uncleared", puzzleId: id };
}

export function buildCalendar(input: {
  epoch: string;
  today: string;
  schedule: readonly string[];
  clearedIds: ReadonlySet<string>;
  inProgressIds: ReadonlySet<string>;
}): CalendarModel {
  const { epoch, today, schedule, clearedIds, inProgressIds } = input;
  const [ey, em] = epoch.split("-").map(Number);
  const [ty, tm] = today.split("-").map(Number);

  const months: MonthGroup[] = [];
  let y = ty;
  let m = tm;
  // Walk months from today's month back to the epoch's month, inclusive.
  while (y > ey || (y === ey && m >= em)) {
    const cells: DayCell[] = [];
    const lead = firstWeekday(y, m);
    for (let i = 0; i < lead; i++) cells.push({ date: null, day: null, state: "pad" });
    const dim = daysInMonth(y, m);
    for (let d = 1; d <= dim; d++) {
      const date = `${y}-${pad2(m)}-${pad2(d)}`;
      cells.push(classifyDay(date, d, epoch, today, schedule, clearedIds, inProgressIds));
    }
    months.push({ year: y, month: m, label: `${MONTH_NAMES[m - 1]} ${y}`, cells });
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  return { months };
}
