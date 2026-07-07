-- Quality-of-life features: favourite foods + water tracking.
-- Run in the Supabase SQL Editor (after schema.sql).

-- ============================================================
-- favorite_foods: pinned foods for fast re-logging. Stores the same
-- portion snapshot shape as a diary entry.
-- ============================================================
create table public.favorite_foods (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  food_name    text not null,
  brand        text,
  barcode      text,
  serving_qty  numeric not null default 1,
  serving_unit text not null default 'serving',
  calories     numeric not null default 0,
  protein      numeric not null default 0,
  carbs        numeric not null default 0,
  fat          numeric not null default 0,
  created_at   timestamptz not null default now(),
  unique nulls not distinct (user_id, food_name, brand)
);

alter table public.favorite_foods enable row level security;

create policy "Users manage own favorites select"
  on public.favorite_foods for select using (auth.uid() = user_id);
create policy "Users manage own favorites insert"
  on public.favorite_foods for insert with check (auth.uid() = user_id);
create policy "Users manage own favorites delete"
  on public.favorite_foods for delete using (auth.uid() = user_id);

-- ============================================================
-- water_logs: glasses of water per day (one row per user per day).
-- ============================================================
create table public.water_logs (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users (id) on delete cascade,
  logged_on date not null,
  glasses   integer not null default 0 check (glasses between 0 and 32),
  unique (user_id, logged_on)
);

alter table public.water_logs enable row level security;

create policy "Users manage own water select"
  on public.water_logs for select using (auth.uid() = user_id);
create policy "Users manage own water insert"
  on public.water_logs for insert with check (auth.uid() = user_id);
create policy "Users manage own water update"
  on public.water_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own water delete"
  on public.water_logs for delete using (auth.uid() = user_id);
