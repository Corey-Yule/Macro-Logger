-- FitnessApp schema
-- Run this in the Supabase dashboard: SQL Editor > New query > paste > Run.

-- ============================================================
-- profiles: one row per user, holds daily calorie/macro goals.
-- Auth itself lives in Supabase's built-in auth.users table.
-- ============================================================
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  calorie_goal integer not null default 2000,
  protein_goal integer not null default 150,  -- grams
  carbs_goal   integer not null default 250,  -- grams
  fat_goal     integer not null default 65,   -- grams
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create a profile row (with default goals) whenever a user signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- food_logs: one row per logged food item.
-- Nutrition values are stored per entry (already multiplied by
-- the quantity eaten), so daily totals are a simple SUM.
-- ============================================================
create table public.food_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  logged_on    date not null,  -- the diary day, supplied by the client in its local timezone
  meal         text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snacks')),
  food_name    text not null,
  brand        text,
  barcode      text,
  serving_qty  numeric not null default 1,          -- e.g. 1.5
  serving_unit text not null default 'serving',     -- e.g. "g", "serving (30 g)"
  calories     numeric not null default 0,
  protein      numeric not null default 0,  -- grams
  carbs        numeric not null default 0,  -- grams
  fat          numeric not null default 0,  -- grams
  created_at   timestamptz not null default now()
);

-- The diary page always queries "this user, this day"
create index food_logs_user_day_idx on public.food_logs (user_id, logged_on);

alter table public.food_logs enable row level security;

create policy "Users can read own logs"
  on public.food_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own logs"
  on public.food_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own logs"
  on public.food_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own logs"
  on public.food_logs for delete
  using (auth.uid() = user_id);
