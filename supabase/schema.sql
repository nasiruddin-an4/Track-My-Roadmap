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

-- ---------------------------------------------------------------------------
-- Size limits, so one account can't fill the database. Safe to re-run.
-- Real use is far below these: the largest roadmap has ~335 topics; 5 years of habits is ~400 KB.
-- ---------------------------------------------------------------------------
alter table public.roadmap_progress drop constraint if exists roadmap_progress_limits;
alter table public.roadmap_progress add constraint roadmap_progress_limits check (
  roadmap ~ '^[a-z0-9-]{1,80}$'
  and cardinality(done) <= 1000
  and octet_length(array_to_string(done, '')) <= 100000
);

alter table public.habit_trackers drop constraint if exists habit_trackers_limits;
alter table public.habit_trackers add constraint habit_trackers_limits check (
  octet_length(data::text) <= 1000000
);

-- At most 100 roadmap rows per person (there are ~50 roadmaps). Updating an existing row is always allowed.
create or replace function public.limit_roadmap_rows()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.roadmap_progress p
      where p.user_id = new.user_id and p.roadmap <> new.roadmap) >= 100 then
    raise exception 'Too many roadmaps for one account' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function public.limit_roadmap_rows() from public, anon, authenticated;

drop trigger if exists limit_roadmap_rows on public.roadmap_progress;
create trigger limit_roadmap_rows
  before insert on public.roadmap_progress
  for each row execute function public.limit_roadmap_rows();

-- When a roadmap was first completed (ms since epoch), for the certificate date. Cleared if a required topic is unticked.
alter table public.roadmap_progress add column if not exists completed_at bigint;

-- ---------------------------------------------------------------------------
-- Feedback from signed-in learners. Safe to re-run.
-- Learners can only add feedback; only admins can read, update (status) or delete it.
-- ---------------------------------------------------------------------------
create table if not exists public.feedback (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  kind       text        not null check (kind in ('idea', 'bug', 'content', 'other')),
  rating     smallint    check (rating between 1 and 5),       -- optional "how useful is it so far?"
  message    text        not null check (char_length(message) between 3 and 2000),
  page       text        check (char_length(page) <= 200),     -- the page it was sent from
  status     text        not null default 'new' check (status in ('new', 'read', 'done')),
  created_at timestamptz not null default now()
);

create index if not exists feedback_created_idx on public.feedback (created_at desc);
create index if not exists feedback_user_idx on public.feedback (user_id, created_at);

alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;
grant insert, select, update, delete on public.feedback to authenticated;

drop policy if exists "Send own feedback" on public.feedback;
create policy "Send own feedback" on public.feedback
  for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'new');

drop policy if exists "Admins read feedback" on public.feedback;
create policy "Admins read feedback" on public.feedback
  for select to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

drop policy if exists "Admins update feedback" on public.feedback;
create policy "Admins update feedback" on public.feedback
  for update to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

drop policy if exists "Admins delete feedback" on public.feedback;
create policy "Admins delete feedback" on public.feedback
  for delete to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

-- At most 10 messages per person per day. Learners can't read the feedback table, so the count runs with the
-- function owner's rights; it lives in a schema the Data API doesn't expose and only counts the sender's rows.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.limit_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.feedback f
      where f.user_id = new.user_id and f.created_at > now() - interval '1 day') >= 10 then
    raise exception 'Too much feedback today' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function private.limit_feedback() from public, anon, authenticated;

drop trigger if exists limit_feedback on public.feedback;
create trigger limit_feedback
  before insert on public.feedback
  for each row execute function private.limit_feedback();
