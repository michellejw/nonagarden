-- Nonagarden content backend (slice 2): puzzles + daily_schedule.

create table puzzles (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique,                          -- human-readable; seed upsert key (null for Studio puzzles)
  name        text not null,                        -- hidden answer, revealed on win
  size        int  not null check (size between 1 and 25),
  rows        text[] not null,                      -- solution; "#.#.." format, same as Puzzle.rows
  difficulty  text not null check (difficulty in ('forager','woodlander','mycologist')),
  status      text not null default 'draft' check (status in ('draft','published')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table daily_schedule (
  position    int  primary key,                     -- 0-indexed; APPEND-ONLY, never reordered
  puzzle_id   uuid not null references puzzles (id),
  created_at  timestamptz not null default now()
);

create index puzzles_status_idx on puzzles (status);

-- "Automatically expose new tables" is OFF, so grant Data-API access explicitly.
-- RLS (below) still decides WHICH rows each role sees; these grants only open
-- the tables to the API at all.
grant select on puzzles, daily_schedule to anon, authenticated;
grant insert, update, delete on puzzles, daily_schedule to authenticated;

-- Row-Level Security.
alter table puzzles        enable row level security;
alter table daily_schedule enable row level security;

-- Anonymous players read PUBLISHED puzzles only; drafts stay private.
create policy "public read published puzzles" on puzzles
  for select using (status = 'published');

-- The author (any authenticated user — solo for now) reads/writes everything.
create policy "author writes puzzles" on puzzles
  for all to authenticated using (true) with check (true);

-- Schedule is publicly readable; only the author writes it.
create policy "public read schedule" on daily_schedule
  for select using (true);

create policy "author writes schedule" on daily_schedule
  for all to authenticated using (true) with check (true);
