-- Track My Roadmap: database tables.
-- Run once in Supabase → SQL Editor → New query → paste → Run.
-- Each person can only read and write their own rows (row level security).

-- Ticked topics, one row per person per roadmap.
create table if not exists public.roadmap_progress (
  user_id    uuid   not null references auth.users (id) on delete cascade,
  roadmap    text   not null,                 -- roadmap slug, e.g. 'software-engineer'
  done       text[] not null default '{}',    -- ticked topic keys
  updated_at bigint not null default 0,       -- ms since epoch; newest copy wins when syncing
  primary key (user_id, roadmap)
);

-- Habit tracker, one row per person.
create table if not exists public.habit_trackers (
  user_id    uuid   primary key references auth.users (id) on delete cascade,
  data       jsonb  not null default '{}',    -- { habits, checks, notes }
  updated_at bigint not null default 0
);

alter table public.roadmap_progress enable row level security;
alter table public.habit_trackers  enable row level security;

-- Let signed-in users reach these tables through the Data API (new projects may not expose
-- new tables automatically). Row level security below still limits each person to their own rows.
revoke all on public.roadmap_progress, public.habit_trackers from anon;
grant select, insert, update, delete on public.roadmap_progress, public.habit_trackers to authenticated;

drop policy if exists "Own roadmap progress" on public.roadmap_progress;
create policy "Own roadmap progress" on public.roadmap_progress
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Own habit tracker" on public.habit_trackers;
create policy "Own habit tracker" on public.habit_trackers
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Admins and recommended YouTube videos per topic.
-- Safe to re-run. After running, make yourself an admin (use the email you sign in with):
--   insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';
-- ---------------------------------------------------------------------------

-- People who can manage topic videos at /admin. Only rows added in the SQL editor count;
-- nobody can add themselves from the app.
create table if not exists public.admins (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;

-- Each person can only see whether they themselves are an admin.
drop policy if exists "See own admin row" on public.admins;
create policy "See own admin row" on public.admins
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Recommended YouTube videos, playlists and channels, one row each, attached to a topic key
-- (the same keys progress uses, e.g. 'p1/programming-basics/loops').
create table if not exists public.topic_resources (
  id         uuid        primary key default gen_random_uuid(),
  roadmap    text        not null,                -- roadmap slug, e.g. 'software-engineer'
  topic_key  text        not null,
  kind       text        not null check (kind in ('video', 'playlist', 'channel')),
  url        text        not null check (url ~ '^https://(www\.)?youtube\.com/' and char_length(url) <= 300),
  title      text        not null check (char_length(title) between 1 and 200),
  channel    text        check (char_length(channel) <= 120),
  thumbnail  text        check (thumbnail ~ '^https://i[0-9]?\.ytimg\.com/' and char_length(thumbnail) <= 300),
  note       text        check (char_length(note) <= 280),  -- why this one, e.g. "Best 20-minute intro"
  position   integer     not null default 0,      -- order within the topic, lowest first
  created_by uuid        default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists topic_resources_roadmap_idx on public.topic_resources (roadmap, topic_key, position);

alter table public.topic_resources enable row level security;
revoke all on public.topic_resources from anon;
grant select, insert, update, delete on public.topic_resources to authenticated;

-- Signed-in people read every recommendation (the roadmap topics themselves are for signed-in people too).
drop policy if exists "Read topic resources" on public.topic_resources;
create policy "Read topic resources" on public.topic_resources
  for select to authenticated
  using (true);

-- Only admins add, change or remove them.
drop policy if exists "Admins add topic resources" on public.topic_resources;
create policy "Admins add topic resources" on public.topic_resources
  for insert to authenticated
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

drop policy if exists "Admins change topic resources" on public.topic_resources;
create policy "Admins change topic resources" on public.topic_resources
  for update to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

drop policy if exists "Admins remove topic resources" on public.topic_resources;
create policy "Admins remove topic resources" on public.topic_resources
  for delete to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));
