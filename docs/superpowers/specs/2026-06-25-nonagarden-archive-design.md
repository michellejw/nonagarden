# Nonagarden — Archive (slice #5) design

**Date:** 2026-06-25
**Slice:** #5 archive / progress
**Status:** design approved, ready for implementation plan

## Summary

Replace the flat Library wall (slice #4) with a **NYT-crossword-style daily Archive**: a
calendar of past dailies you can replay, keyed by date, with the streak surfaced. The Archive
becomes the **only** browse surface — today's puzzle is played from the front door (`/`), and
everything before today lives on the calendar. Modeled on the Mycogrid (`rootline`) archive
UX, adapted to the web stack and Nonagarden's mushroom/garden identity.

This is a presentation change, not an engine change. The play surface (`usePuzzleGame` +
`Board`), the cleared ledger, the in-progress board store, and the hidden-name reveal all carry
straight over from slices #1/#3/#4. We retire the *flat-wall presentation*, not the machinery.

## Decisions (from brainstorming 2026-06-25)

- **Calendar replaces Library.** One browse surface. Drop `/library` + `/library/[slug]`;
  301-redirect both to the new archive so no URL breaks.
- **Unscheduled pool puzzles are invisible until scheduled.** Published-but-undated puzzles are a
  pure authoring backlog with no player surface. You cannot play ahead of the schedule
  (NYT-faithful). This is an intentional behavior change from slice #4, which let you play
  unscheduled pool puzzles.
- **Calendar range = `DAILY_EPOCH` → today.** No sliding floor (Mycogrid's first-open − 14 days
  trick exists only to cap deep history; our run is young — the catalog grows forward from the
  epoch).
- **Streak is day-of only.** Completing a past daily from the Archive marks the day cleared but
  **never** repairs or extends the streak. `src/lib/daily/streak.ts` is untouched. The streak line
  on the calendar is display-only (`currentStreakAsOf`).
- **Date-based routing.** Play/reveal at `/archive/[date]` (e.g. `/archive/2026-06-23`), not by
  slug. The old `/library/[slug]` URL leaked the puzzle name; a date URL preserves the hidden-name
  payoff.
- **Cleared-day tap → reveal view + "Play again".** Opens to the solved picture + name (the
  collection payoff), with an opt-in fresh replay. Replay never un-clears or alters state.
- **Nav label = "Archive."** Front door stays "Daily."
- **Cell visuals = symbolic mushroom, no thumbnails.** Reuse slice #4's mushroom-state language:
  muted 🍄 = uncleared, full-colour 🍄 = cleared, in-progress tint when a saved board exists, 2pt
  ring = today. The picture + name reveal happens on the detail view, never on the cell.

## Surfaces & routing

| Route | Type | Purpose |
|---|---|---|
| `/archive` | ISR server component (`revalidate=3600`) | the calendar; fetches the schedule + published puzzles like the daily does, hands them to a client `ArchiveScreen` |
| `/archive/[date]` | server resolves date→puzzle, client plays | reveal (if cleared) or play (if not) for one past day |
| `/library`, `/library/[slug]` | redirect | 301 → `/archive` (flat; no per-slug date lookup) |

Nav: the header "Library" link becomes "Archive" → `/archive`. Front door `/` (live daily) unchanged.

## Calendar model & visuals

Borrowed from Mycogrid, adapted to web + Tailwind v4 + `@shroomgames/tokens`:

- **Month-grouped 7-column grids**, most-recent month on top, vertical scroll (no pager).
- Weekday headers (S M T W T F S) per month; leading pad cells align the first day to its column.
- **Range strictly `DAILY_EPOCH` → today.** Pre-epoch days are not rendered. Future days in the
  current month render faded/disabled (not tappable).
- **2pt ring** on today's cell.

Cell states:

| State | When | Visual | Tap |
|---|---|---|---|
| today | date == local today | ring | → `/` (front door) |
| cleared | id in `nonagarden.cleared.v1` | full-colour 🍄 | → `/archive/[date]` reveal view |
| in-progress | saved board in `nonagarden.library.v1`, not cleared | tinted 🍄 | → `/archive/[date]` resume play |
| uncleared past | scheduled, date < today, no board | muted 🍄 | → `/archive/[date]` fresh play |
| gap | scheduled position with no puzzle | inert, faded | none |
| future / pad | date > today or pad cell | faded | none |

Header carries the streak line: `{n} day streak` (omit when 0), reading `currentStreakAsOf` with
the player's local date.

## Play & reveal behavior

`/archive/[date]` resolves the date to a puzzle (see Data flow) and branches:

- **Today** is never played here — the cell links to `/`. If someone hits `/archive/<today>`
  directly, redirect to `/`.
- **Uncleared past day** → fresh or resumable play. Reuses `usePuzzleGame` + `Board`. Resume reads
  `nonagarden.library.v1` (keyed by puzzle id); auto-save on change; empty boards not persisted.
  Win writes `nonagarden.cleared.v1` (global, by id) and drops the in-progress board. **Never**
  touches streak. Hidden name in the play header (neutral "Archive · {date}"); name + picture
  revealed only in the win card.
- **Cleared day** → **reveal view first**: solved picture + name shown immediately ("here's what
  you unlocked"), with a **"Play again"** button that starts a fresh board (entering the
  uncleared-play flow above, but the day stays cleared regardless of outcome).
- **Guards:** date > local today → "hasn't sprouted yet 🌱" gate; date < epoch → not-found; date in
  range but unscheduled / gap → empty "no puzzle that day" state.

## Data flow

Reuses the existing spine; no schema or migration work.

- **Schedule + puzzles:** the `/archive` server component fetches published puzzles + the
  append-only `daily_schedule` (same fetch the daily front door uses). Passed as props to the
  client screen.
- **Date → puzzle:** a pure `dateToPuzzle(date, schedule, puzzles)` computes `daysSince(epoch,
  date)` → schedule position → `puzzle_id` → puzzle, mirroring `dailyFor`. Returns the puzzle, or a
  reason (`before-epoch` | `future` | `gap` | `not-found`).
- **Today (timezone):** computed client-side from the player's **local** date, exactly as slice #4
  did, so "past vs today vs future" agrees with the daily front door across timezones. The server
  component stays date-agnostic; the client decides which cells are live.
- **Cleared ledger** (`nonagarden.cleared.v1`, by puzzle id): read to mark cells; written on
  archive win. A day-of front-door solve already writes this ledger, so today's cell lights up for
  free and stays consistent.
- **In-progress boards** (`nonagarden.library.v1`, by puzzle id): resume source for past plays.
- **Streak** (`nonagarden.daily.v1`): read for the header line only; never written by the Archive.

## Decomposition

Pure, testable units first (keeps the quality bar; mirrors prior slices):

- **`src/lib/archive/calendar.ts`** — pure `buildCalendar({ epoch, todayLocal, schedule, puzzles,
  clearedIds, inProgressIds }) → CalendarModel` (months → day cells, each with date, state, and
  resolved puzzle id where applicable). No React, no `Date.now()` inside — `todayLocal` is injected.
- **`src/lib/archive/resolve.ts`** — pure `dateToPuzzle(date, schedule, puzzles)` + the
  guard/reason logic shared by the calendar and the play route.
- **`ArchiveCalendar`** — presentational; renders a `CalendarModel` (months, weekday headers, cells).
- **`ArchiveScreen`** — client; reads local today + cleared ledger + in-progress store + streak,
  builds the model, renders `ArchiveCalendar` + streak header.
- **`ArchivePlayScreen`** — generalized from `LibraryPlayScreen` (which already does resume +
  ledger-on-win + hidden name + win card); adds the cleared→reveal-first mode and date framing.
  `LibraryPlayScreen` is retired/absorbed.
- **Routes:** `src/app/archive/page.tsx`, `src/app/archive/[date]/page.tsx`; redirects for the old
  library routes.

## Testing

TDD throughout. Pinning + behavior coverage:

- `calendar.ts`: month grouping + weekday padding; epoch floor (nothing before epoch); today ring;
  future/gap/pad cell classification; cell state derivation (cleared / in-progress / uncleared);
  timezone-stable "today" via injected `todayLocal`.
- `resolve.ts`: date→puzzle mapping (matches `dailyFor` for the same date); guards for
  before-epoch, future, gap, not-found.
- Component tests for the three live tap states (today→front door, uncleared→play, cleared→reveal
  + Play again) and the guard gates.
- Redirect tests for the old library routes.
- Full suite + typecheck + lint + prod build green before merge.

## Out of scope / non-goals

- No streak-repair / backfill model (explicitly rejected).
- No "extras" shelf for unscheduled pool puzzles (explicitly rejected).
- No sliding archive floor (young run; grows from epoch).
- No thumbnails on calendar cells.
- No schema or migration changes; no new Supabase queries beyond what the daily already fetches.
- Mobile/touch polish stays deferred (suite-wide desktop-first decision).

## Migration / retirement notes

- `/library` and `/library/[slug]` are removed and redirected. The `nonagarden.cleared.v1` and
  `nonagarden.library.v1` stores are **kept** (same keys, same shapes) — they're the Archive's data
  spine now, so existing player progress carries over seamlessly.
- `LibraryPlayScreen` is absorbed into `ArchivePlayScreen`; `LibraryScreen` (the wall) is deleted.
