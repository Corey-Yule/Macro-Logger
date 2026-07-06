-- Custom & community foods with admin review.
-- Run in the Supabase SQL Editor (after schema.sql). Also grants the admin
-- role to coreyyule22@gmail.com at the bottom.

-- ============================================================
-- User roles. Admins can review community food submissions.
-- ============================================================
alter table public.profiles
  add column role text not null default 'user' check (role in ('user', 'admin'));

-- security definer so it can read profiles.role without tripping over the
-- "users can only read their own profile" RLS policy
create function public.is_admin() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================
-- community_foods: user-created foods. Nutrition is PER SERVING.
-- Lifecycle: private (creator-only, usable immediately)
--   → pending (submitted for review)
--   → approved (searchable by everyone) | rejected (back to creator + note)
-- ============================================================
create table public.community_foods (
  id            uuid primary key default gen_random_uuid(),
  created_by    uuid not null references auth.users (id) on delete cascade,
  name          text not null check (length(name) between 1 and 120),
  brand         text,
  barcode       text,
  serving_label text not null default '1 serving',   -- e.g. "1 sandwich"
  serving_grams numeric check (serving_grams > 0),   -- optional, enables gram-based logging
  calories      numeric not null check (calories >= 0),
  protein       numeric not null default 0 check (protein >= 0),
  carbs         numeric not null default 0 check (carbs >= 0),
  fat           numeric not null default 0 check (fat >= 0),
  status        text not null default 'private'
                check (status in ('private', 'pending', 'approved', 'rejected')),
  review_note   text,
  reviewed_by   uuid references auth.users (id),
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index community_foods_status_idx on public.community_foods (status);
create index community_foods_creator_idx on public.community_foods (created_by);

alter table public.community_foods enable row level security;

create policy "Read own, approved, or admin"
  on public.community_foods for select
  using (created_by = auth.uid() or status = 'approved' or public.is_admin());

create policy "Create own as private or pending"
  on public.community_foods for insert
  with check (created_by = auth.uid() and status in ('private', 'pending'));

-- Creators can edit/resubmit their own foods but can never self-approve
create policy "Creators edit own unapproved"
  on public.community_foods for update
  using (created_by = auth.uid() and status <> 'approved')
  with check (created_by = auth.uid() and status in ('private', 'pending'));

create policy "Admins review"
  on public.community_foods for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "Creators and admins delete"
  on public.community_foods for delete
  using (created_by = auth.uid() or public.is_admin());

-- ============================================================
-- Grant admin
-- ============================================================
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'coreyyule22@gmail.com');
