-- Grant service_role explicit table access for the seed script and admin operations.
-- The service_role bypasses RLS but still needs explicit GRANT when
-- "Automatically expose new tables" is OFF.
grant select, insert, update, delete on public.puzzles, public.daily_schedule to service_role;
