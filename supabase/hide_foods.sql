-- Per-user hide list for "My foods". Hiding an approved community food
-- removes it from the creator's own list WITHOUT deleting it from the
-- community database. Run in the Supabase SQL Editor.

create table public.hidden_community_foods (
  user_id    uuid not null references auth.users (id) on delete cascade,
  food_id    uuid not null references public.community_foods (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, food_id)
);

alter table public.hidden_community_foods enable row level security;

create policy "Users manage own hidden select"
  on public.hidden_community_foods for select using (auth.uid() = user_id);
create policy "Users manage own hidden insert"
  on public.hidden_community_foods for insert with check (auth.uid() = user_id);
create policy "Users manage own hidden delete"
  on public.hidden_community_foods for delete using (auth.uid() = user_id);
