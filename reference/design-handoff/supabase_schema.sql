-- ============================================================
-- Nonogram puzzles — Supabase / Postgres schema
-- ============================================================
-- Run in the Supabase SQL editor. Assumes Supabase Auth is enabled.

create table if not exists public.puzzles (
  id              uuid primary key default gen_random_uuid(),
  title           text not null default 'Untitled',
  size            int  not null check (size between 5 and 25),
  -- rows: JSON array of equal-length strings, '#' = filled, '.' = empty.
  -- e.g. ["..##..", ".####.", ...]  (length === size, count === size)
  rows            jsonb not null,
  difficulty      text not null default 'forager'
                    check (difficulty in ('forager','woodlander','mycologist')),
  -- result of the uniqueness check at save time (see README "Solver").
  unique_solution boolean,
  author_id       uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists puzzles_touch on public.puzzles;
create trigger puzzles_touch before update on public.puzzles
  for each row execute function public.touch_updated_at();

-- index for the game's "browse / newest first" reads
create index if not exists puzzles_created_idx on public.puzzles (created_at desc);

-- ---------- Row Level Security ----------
-- Anyone can READ published puzzles; only the author can write their own.
alter table public.puzzles enable row level security;

create policy "puzzles_public_read"
  on public.puzzles for select using (true);

create policy "puzzles_owner_insert"
  on public.puzzles for insert with check (auth.uid() = author_id);

create policy "puzzles_owner_update"
  on public.puzzles for update using (auth.uid() = author_id);

create policy "puzzles_owner_delete"
  on public.puzzles for delete using (auth.uid() = author_id);

-- If you want the editor restricted to just you, replace the public read
-- with a check against a fixed author_id, or gate writes behind a role.
