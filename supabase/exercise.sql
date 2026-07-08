-- Exercise logging: calories burned add on top of the daily calorie budget.
-- Run in the Supabase SQL Editor.

create table public.exercise_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  logged_on    date not null,
  name         text not null check (length(name) between 1 and 80),
  duration_min numeric check (duration_min > 0),
  calories     numeric not null check (calories > 0),
  created_at   timestamptz not null default now()
);

create index exercise_logs_user_day_idx on public.exercise_logs (user_id, logged_on);

alter table public.exercise_logs enable row level security;

create policy "Users read own exercise"
  on public.exercise_logs for select using (auth.uid() = user_id);
create policy "Users insert own exercise"
  on public.exercise_logs for insert with check (auth.uid() = user_id);
create policy "Users update own exercise"
  on public.exercise_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own exercise"
  on public.exercise_logs for delete using (auth.uid() = user_id);
