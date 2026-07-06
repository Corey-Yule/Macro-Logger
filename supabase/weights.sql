-- Weight tracking — run this in the Supabase SQL Editor (schema.sql must
-- already have been run). One row per user per day; re-logging the same
-- day overwrites it.

create table public.weights (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  measured_on date not null,
  weight      numeric not null check (weight > 0), -- stored as entered (lb or kg)
  created_at  timestamptz not null default now(),
  unique (user_id, measured_on)
);

create index weights_user_day_idx on public.weights (user_id, measured_on);

alter table public.weights enable row level security;

create policy "Users can read own weights"
  on public.weights for select
  using (auth.uid() = user_id);

create policy "Users can insert own weights"
  on public.weights for insert
  with check (auth.uid() = user_id);

create policy "Users can update own weights"
  on public.weights for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own weights"
  on public.weights for delete
  using (auth.uid() = user_id);
