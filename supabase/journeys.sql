-- =============================================================================
-- Track My Roadmap: creator journeys and social features (step 1 of IMPROVEMENTS.md).
--
-- Run AFTER supabase/schema.sql (it uses public.admins). Supabase → SQL Editor → paste → Run. Safe to re-run.
-- Nothing in the app reads these tables yet: the official roadmaps keep working from roadmap_progress until
-- they're moved over. Everything here is free to use; there are no paid journeys.
--
-- What each feature is built on:
--   Profiles            profiles            one row per account (a key → value lookup, like a hash table)
--   Friends network     follows             a graph: each row is a directed edge, follower → following;
--                                           "friends" are people who follow each other
--   Journeys            journeys            the creator's draft lives here; publishing freezes a copy into
--                       journey_versions    an immutable version, so editing never breaks learners' progress
--   Learner progress    subscriptions       current state per learner per journey (what's ticked now)
--                       progress_events     append-only log of every tick and untick (powers analytics and
--                                           the activity feed; written by a trigger, never by the browser)
--   Activity feed       (no table)          read from progress_events of the people you follow, newest first
--   Comments            comments            a tree: replies point at their parent (one level of replies)
--   Notifications       notifications       a per-person inbox queue, filled by triggers
--   Search              journeys.search     a full-text index (Postgres's inverted index) over title, tagline,
--                                           tags and description
--   Cached data         journeys.subscriber_count  a counter kept in sync by triggers, so the marketplace
--                                           never has to count rows on every page view
--   Moderation          reports             anyone signed in can report a journey or comment; admins review
--
-- Topics inside a journey have stable ids ("t_8f3k2a"), not ids made from their names, so a creator can rename
-- or move a topic without resetting anyone's tick. The structure of journey JSON:
--   { "phases": [ { "id": "p_…", "title": "…", "cards": [ { "id": "c_…", "title": "…", "mode": "list" | "pick",
--       "topics": [ { "id": "t_…", "name": "…", "tag": "do" | "opt" | "adv" | "cont",
--                     "resources": [ { "kind": "video" | "article" | "course", "url": "https://…", "title": "…" } ] } ] } ] } ] }
-- =============================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Profiles: public info for each account. Created automatically when someone signs up.
-- Creators are invite-only: an admin sets is_creator in the SQL editor:
--   update public.profiles set is_creator = true where id = (select id from auth.users where email = 'creator@example.com');
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                  uuid        primary key references auth.users (id) on delete cascade,
  username            text        unique check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name        text        not null default '' check (char_length(display_name) <= 80),
  avatar_url          text        check (avatar_url ~ '^https://' and char_length(avatar_url) <= 500),
  bio                 text        not null default '' check (char_length(bio) <= 280),
  -- who may see this person's progress in feeds and on their profile
  progress_visibility text        not null default 'followers' check (progress_visibility in ('public', 'followers', 'private')),
  is_creator          boolean     not null default false,
  created_at          timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
-- people edit only these columns of their own row; is_creator and created_at stay out of reach
grant update (username, display_name, avatar_url, bio, progress_visibility) on public.profiles to authenticated;
grant all on public.profiles to service_role;

drop policy if exists "Profiles are public" on public.profiles;
create policy "Profiles are public" on public.profiles
  for select to anon, authenticated
  using (true);

drop policy if exists "Edit own profile" on public.profiles;
create policy "Edit own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- A profile for every new account, named from their Google account. (The name and photo come from user_metadata,
-- which the person can change; that's fine for display, and nothing here uses it to decide access.)
create or replace function private.create_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''), 80),
    case when new.raw_user_meta_data ->> 'avatar_url' ~ '^https://' and char_length(new.raw_user_meta_data ->> 'avatar_url') <= 500
         then new.raw_user_meta_data ->> 'avatar_url' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
revoke all on function private.create_profile() from public, anon, authenticated;

drop trigger if exists create_profile on auth.users;
create trigger create_profile
  after insert on auth.users
  for each row execute function private.create_profile();

-- profiles for everyone who signed up before this ran
insert into public.profiles (id, display_name, avatar_url)
select u.id,
       left(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''), 80),
       case when u.raw_user_meta_data ->> 'avatar_url' ~ '^https://' and char_length(u.raw_user_meta_data ->> 'avatar_url') <= 500
            then u.raw_user_meta_data ->> 'avatar_url' end
from auth.users u
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- Follows: the friends graph. A row means follower → following. Two rows in opposite directions = friends.
-- -----------------------------------------------------------------------------
create table if not exists public.follows (
  follower_id  uuid        not null references public.profiles (id) on delete cascade,
  following_id uuid        not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

-- "who follows me" (the primary key already covers "who do I follow")
create index if not exists follows_following_idx on public.follows (following_id);

alter table public.follows enable row level security;
revoke all on public.follows from anon, authenticated;
grant select, delete on public.follows to authenticated;
grant insert (following_id) on public.follows to authenticated;
grant all on public.follows to service_role;

drop policy if exists "See follows" on public.follows;
create policy "See follows" on public.follows
  for select to authenticated
  using (true);

drop policy if exists "Follow people" on public.follows;
create policy "Follow people" on public.follows
  for insert to authenticated
  with check (follower_id = (select auth.uid()));

-- unfollow someone, or remove one of your followers
drop policy if exists "Unfollow" on public.follows;
create policy "Unfollow" on public.follows
  for delete to authenticated
  using (follower_id = (select auth.uid()) or following_id = (select auth.uid()));

create or replace function private.follow_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.follower_id := coalesce((select auth.uid()), new.follower_id);
  if (select count(*) from public.follows f where f.follower_id = new.follower_id) >= 2000 then
    raise exception 'Following too many people' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function private.follow_defaults() from public, anon, authenticated;

drop trigger if exists follow_defaults on public.follows;
create trigger follow_defaults
  before insert on public.follows
  for each row execute function private.follow_defaults();

-- -----------------------------------------------------------------------------
-- Journeys: what a creator builds. `draft` is the work in progress; publish_journey() freezes it into
-- journey_versions. Official roadmaps have official = true and no creator.
-- -----------------------------------------------------------------------------

-- Tags as one string, for the search index (array_to_string isn't marked immutable, so generated columns
-- can't call it directly; for text[] the result never changes, so this wrapper is safe to mark immutable).
create or replace function private.tags_text(tags text[])
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$ select coalesce(array_to_string(tags, ' '), '') $$;
revoke all on function private.tags_text(text[]) from public;
-- writing a journey computes the search column, which calls this (guests never write journeys)
grant execute on function private.tags_text(text[]) to authenticated, service_role;

create table if not exists public.journeys (
  id               uuid        primary key default gen_random_uuid(),
  slug             text        not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 80),
  creator_id       uuid        references public.profiles (id) on delete set null,
  official         boolean     not null default false,
  title            text        not null check (char_length(title) between 3 and 120),
  tagline          text        not null default '' check (char_length(tagline) <= 200),
  description      text        not null default '' check (char_length(description) <= 4000),
  category         text        not null default 'skill' check (category in ('career', 'skill')),
  level            text        not null default '' check (char_length(level) <= 40),   -- e.g. 'Beginner to advanced'
  tags             text[]      not null default '{}' check (cardinality(tags) <= 10),
  cover_url        text        check (cover_url ~ '^https://' and char_length(cover_url) <= 500),
  draft            jsonb       not null default '{"phases": []}' check (octet_length(draft::text) <= 500000),
  status           text        not null default 'draft' check (status in ('draft', 'published', 'archived', 'removed')),
  version          integer     not null default 0,   -- latest published version; 0 = never published
  subscriber_count integer     not null default 0,   -- kept in sync by a trigger on subscriptions
  search           tsvector    generated always as (
                     setweight(to_tsvector('english', title), 'A') ||
                     setweight(to_tsvector('english', tagline), 'B') ||
                     setweight(to_tsvector('english', private.tags_text(tags)), 'B') ||
                     setweight(to_tsvector('english', description), 'C')
                   ) stored,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  published_at     timestamptz   -- creator_id becomes null if the creator deletes their account; the journey stays for its learners
);

create index if not exists journeys_search_idx on public.journeys using gin (search);
create index if not exists journeys_tags_idx on public.journeys using gin (tags);
create index if not exists journeys_creator_idx on public.journeys (creator_id);
-- the marketplace's default listing: published journeys, most followed first
create index if not exists journeys_marketplace_idx on public.journeys (subscriber_count desc, published_at desc) where status = 'published';

alter table public.journeys enable row level security;
revoke all on public.journeys from anon, authenticated;
grant select on public.journeys to anon, authenticated;
grant insert (slug, title, tagline, description, category, level, tags, cover_url, draft) on public.journeys to authenticated;
-- creators change content and archive/unarchive; version, counts, official and creator_id stay out of reach
grant update (slug, title, tagline, description, category, level, tags, cover_url, draft, status) on public.journeys to authenticated;
grant delete on public.journeys to authenticated;
grant all on public.journeys to service_role;

-- Everyone sees published journeys; creators also see their own drafts; admins see everything.
-- (Two policies: visitors who aren't signed in can't read public.admins, so their policy mustn't look there.)
drop policy if exists "Read journeys" on public.journeys;
drop policy if exists "Visitors read published journeys" on public.journeys;
create policy "Visitors read published journeys" on public.journeys
  for select to anon
  using (status = 'published');

drop policy if exists "Members read journeys" on public.journeys;
create policy "Members read journeys" on public.journeys
  for select to authenticated
  using (
    status = 'published'
    or creator_id = (select auth.uid())
    or exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
  );

-- Only invited creators start journeys, always as their own draft.
drop policy if exists "Creators add journeys" on public.journeys;
create policy "Creators add journeys" on public.journeys
  for insert to authenticated
  with check (
    creator_id = (select auth.uid())
    and status = 'draft'
    and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.is_creator)
  );

-- Creators edit their own journeys. They can archive one, but only publish_journey() makes it 'published'
-- and only admins can mark one 'removed'.
drop policy if exists "Creators edit own journeys" on public.journeys;
create policy "Creators edit own journeys" on public.journeys
  for update to authenticated
  using (creator_id = (select auth.uid()) and status <> 'removed')
  with check (creator_id = (select auth.uid()) and status in ('draft', 'published', 'archived'));

-- A journey can be deleted only while it's never been published; after that, archive it so learners keep it.
drop policy if exists "Creators delete unpublished journeys" on public.journeys;
create policy "Creators delete unpublished journeys" on public.journeys
  for delete to authenticated
  using (creator_id = (select auth.uid()) and version = 0);

-- creator_id is always the person creating it, and drafts can't jump straight to published
create or replace function private.journey_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.creator_id := coalesce((select auth.uid()), new.creator_id);
  end if;
  -- through the app, 'published' is only reachable from publish_journey(), which sets version first
  if new.status = 'published' and new.version = 0 then
    raise exception 'Publish a journey with publish_journey()' using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.journey_defaults() from public, anon, authenticated;

drop trigger if exists journey_defaults on public.journeys;
create trigger journey_defaults
  before insert or update on public.journeys
  for each row execute function private.journey_defaults();

-- -----------------------------------------------------------------------------
-- Published versions: frozen copies of a journey's structure. Learners follow a version, so a creator's edits
-- never change what someone is halfway through until they choose to update.
-- -----------------------------------------------------------------------------
create table if not exists public.journey_versions (
  journey_id  uuid        not null references public.journeys (id) on delete cascade,
  version     integer     not null check (version > 0),
  content     jsonb       not null check (octet_length(content::text) <= 500000),
  topic_count integer     not null default 0,
  note        text        not null default '' check (char_length(note) <= 500),  -- "what changed", shown to learners
  created_at  timestamptz not null default now(),
  primary key (journey_id, version)
);

alter table public.journey_versions enable row level security;
revoke all on public.journey_versions from anon, authenticated;
grant select on public.journey_versions to anon, authenticated;
grant all on public.journey_versions to service_role;

drop policy if exists "Read published versions" on public.journey_versions;
create policy "Read published versions" on public.journey_versions
  for select to anon, authenticated
  using (exists (
    select 1 from public.journeys j
    where j.id = journey_id
      and (j.status = 'published' or j.creator_id = (select auth.uid()))
  ));

-- Publish (or re-publish) a journey: copy the draft into a new version, mark it published and tell subscribers.
-- Called from the app as supabase.rpc('publish_journey', { p_journey, p_note }).
create or replace function public.publish_journey(p_journey uuid, p_note text default '')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  j       public.journeys;
  next_v  integer;
  topics  integer;
begin
  select * into j from public.journeys where id = p_journey for update;
  if j.id is null or j.creator_id is distinct from (select auth.uid()) then
    raise exception 'Not your journey' using errcode = 'insufficient_privilege';
  end if;
  if j.status = 'removed' then
    raise exception 'This journey was removed' using errcode = 'check_violation';
  end if;
  select count(*) into topics from jsonb_path_query(j.draft, '$.phases[*].cards[*].topics[*]');
  if topics = 0 then
    raise exception 'Add at least one topic before publishing' using errcode = 'check_violation';
  end if;

  next_v := j.version + 1;
  insert into public.journey_versions (journey_id, version, content, topic_count, note)
  values (j.id, next_v, j.draft, topics, left(coalesce(p_note, ''), 500));
  update public.journeys
     set version = next_v, status = 'published', published_at = coalesce(published_at, now())
   where id = j.id;

  if next_v > 1 then
    insert into public.notifications (user_id, kind, actor_id, journey_id)
    select s.user_id, 'journey_updated', j.creator_id, j.id
    from public.subscriptions s
    where s.journey_id = j.id and s.user_id <> j.creator_id;
  end if;
  return next_v;
end;
$$;

-- -----------------------------------------------------------------------------
-- Subscriptions: a learner following a journey, with what they've ticked (topic ids) right now.
-- -----------------------------------------------------------------------------
create table if not exists public.subscriptions (
  user_id        uuid        not null references auth.users (id) on delete cascade,
  journey_id     uuid        not null references public.journeys (id) on delete cascade,
  version        integer     not null default 1 check (version > 0),   -- the published version they follow
  done           text[]      not null default '{}' check (cardinality(done) <= 2000),
  subscribed_at  timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  completed_at   timestamptz,
  primary key (user_id, journey_id)
);

create index if not exists subscriptions_journey_idx on public.subscriptions (journey_id, last_active_at desc);

alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from anon, authenticated;
grant select, delete on public.subscriptions to authenticated;
grant insert (journey_id, version, done) on public.subscriptions to authenticated;
grant update (version, done, completed_at) on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;

drop policy if exists "Own subscriptions" on public.subscriptions;
create policy "Own subscriptions" on public.subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- subscribe only to published journeys, to a version that exists
drop policy if exists "Subscribe to published journeys" on public.subscriptions;
create policy "Subscribe to published journeys" on public.subscriptions
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.journeys j
                where j.id = subscriptions.journey_id and j.status = 'published' and subscriptions.version between 1 and j.version)
  );

drop policy if exists "Update own subscriptions" on public.subscriptions;
create policy "Update own subscriptions" on public.subscriptions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.journeys j where j.id = subscriptions.journey_id and subscriptions.version between 1 and j.version)
  );

drop policy if exists "Unsubscribe" on public.subscriptions;
create policy "Unsubscribe" on public.subscriptions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- user_id is always the signed-in person
create or replace function private.subscription_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.user_id := coalesce((select auth.uid()), new.user_id);
  end if;
  new.last_active_at := now();
  return new;
end;
$$;
revoke all on function private.subscription_defaults() from public, anon, authenticated;

drop trigger if exists subscription_defaults on public.subscriptions;
create trigger subscription_defaults
  before insert or update on public.subscriptions
  for each row execute function private.subscription_defaults();

-- Keeps journeys.subscriber_count right, and logs every tick and untick into progress_events by comparing
-- the old and new `done` lists. Learners can't write either directly, so counts and history can't be faked.
create or replace function private.subscription_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.journeys set subscriber_count = subscriber_count + 1 where id = new.journey_id;
  elsif tg_op = 'DELETE' then
    update public.journeys set subscriber_count = greatest(subscriber_count - 1, 0) where id = old.journey_id;
    return old;
  end if;

  insert into public.progress_events (user_id, journey_id, topic_id, done)
  select new.user_id, new.journey_id, t, true
  from unnest(new.done) t
  where tg_op = 'INSERT' or not t = any (old.done)
  union all
  select new.user_id, new.journey_id, t, false
  from unnest(case when tg_op = 'UPDATE' then old.done else '{}'::text[] end) t
  where not t = any (new.done);
  return new;
end;
$$;
revoke all on function private.subscription_changed() from public, anon, authenticated;

drop trigger if exists subscription_changed on public.subscriptions;
create trigger subscription_changed
  after insert or update of done or delete on public.subscriptions
  for each row execute function private.subscription_changed();

-- -----------------------------------------------------------------------------
-- Progress events: append-only history of ticks. Feeds creator analytics ("where do people stop?") and the
-- activity feed. Only the trigger above writes here.
-- -----------------------------------------------------------------------------
create table if not exists public.progress_events (
  id         bigint      generated always as identity primary key,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  journey_id uuid        not null references public.journeys (id) on delete cascade,
  topic_id   text        not null check (char_length(topic_id) <= 64),
  done       boolean     not null,   -- true = ticked, false = unticked
  created_at timestamptz not null default now()
);

create index if not exists progress_events_journey_idx on public.progress_events (journey_id, created_at desc);
create index if not exists progress_events_user_idx on public.progress_events (user_id, created_at desc);

alter table public.progress_events enable row level security;
revoke all on public.progress_events from anon, authenticated;
grant select on public.progress_events to authenticated;
grant all on public.progress_events to service_role;

-- Your own history; the history of people you follow, if they share their progress with followers or everyone
-- (that's the activity feed); and creators see the history of their own journeys (for analytics).
drop policy if exists "Read progress events" on public.progress_events;
create policy "Read progress events" on public.progress_events
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.profiles p
      where p.id = user_id
        and (p.progress_visibility = 'public'
             or (p.progress_visibility = 'followers'
                 and exists (select 1 from public.follows f where f.follower_id = (select auth.uid()) and f.following_id = p.id)))
    )
    or exists (select 1 from public.journeys j where j.id = journey_id and j.creator_id = (select auth.uid()))
  );

-- -----------------------------------------------------------------------------
-- Comments on published journeys: a tree with one level of replies (a reply's parent is a top-level comment).
-- -----------------------------------------------------------------------------
create table if not exists public.comments (
  id         uuid        primary key default gen_random_uuid(),
  journey_id uuid        not null references public.journeys (id) on delete cascade,
  parent_id  uuid        references public.comments (id) on delete cascade,
  author_id  uuid        not null references public.profiles (id) on delete cascade,
  body       text        not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  edited_at  timestamptz
);

create index if not exists comments_journey_idx on public.comments (journey_id, created_at);
create index if not exists comments_parent_idx on public.comments (parent_id);
create index if not exists comments_author_idx on public.comments (author_id);

alter table public.comments enable row level security;
revoke all on public.comments from anon, authenticated;
grant select on public.comments to anon, authenticated;
grant insert (journey_id, parent_id, body) on public.comments to authenticated;
grant update (body) on public.comments to authenticated;
grant delete on public.comments to authenticated;
grant all on public.comments to service_role;

drop policy if exists "Read comments" on public.comments;
create policy "Read comments" on public.comments
  for select to anon, authenticated
  using (exists (select 1 from public.journeys j where j.id = journey_id and (j.status = 'published' or j.creator_id = (select auth.uid()))));

drop policy if exists "Comment on published journeys" on public.comments;
create policy "Comment on published journeys" on public.comments
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.journeys j where j.id = journey_id and j.status = 'published')
  );

drop policy if exists "Edit own comments" on public.comments;
create policy "Edit own comments" on public.comments
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

-- authors delete their own; a journey's creator and admins can delete any comment on it
drop policy if exists "Delete comments" on public.comments;
create policy "Delete comments" on public.comments
  for delete to authenticated
  using (
    author_id = (select auth.uid())
    or exists (select 1 from public.journeys j where j.id = journey_id and j.creator_id = (select auth.uid()))
    or exists (select 1 from public.admins a where a.user_id = (select auth.uid()))
  );

create or replace function private.comment_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent public.comments;
begin
  if tg_op = 'INSERT' then
    new.author_id := coalesce((select auth.uid()), new.author_id);
    if new.parent_id is not null then
      select * into parent from public.comments where id = new.parent_id;
      if parent.id is null or parent.journey_id <> new.journey_id or parent.parent_id is not null then
        raise exception 'Reply to a top-level comment on the same journey' using errcode = 'check_violation';
      end if;
    end if;
    if (select count(*) from public.comments c where c.author_id = new.author_id and c.created_at > now() - interval '1 day') >= 50 then
      raise exception 'Too many comments today' using errcode = 'check_violation';
    end if;
  else
    new.edited_at := now();
  end if;
  return new;
end;
$$;
revoke all on function private.comment_defaults() from public, anon, authenticated;

drop trigger if exists comment_defaults on public.comments;
create trigger comment_defaults
  before insert or update on public.comments
  for each row execute function private.comment_defaults();

-- -----------------------------------------------------------------------------
-- Notifications: each person's inbox, filled by triggers (new follower, reply, comment on your journey,
-- journey updated). People read them, mark them read and delete them; nobody writes them from the browser.
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id         bigint      generated always as identity primary key,
  user_id    uuid        not null references auth.users (id) on delete cascade,   -- who it's for
  kind       text        not null check (kind in ('new_follower', 'comment_reply', 'new_comment', 'journey_updated')),
  actor_id   uuid        references public.profiles (id) on delete cascade,      -- who caused it
  journey_id uuid        references public.journeys (id) on delete cascade,
  comment_id uuid        references public.comments (id) on delete cascade,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_inbox_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index if not exists notifications_actor_idx on public.notifications (actor_id);
create index if not exists notifications_journey_idx on public.notifications (journey_id);
create index if not exists notifications_comment_idx on public.notifications (comment_id);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;

drop policy if exists "Own notifications" on public.notifications;
create policy "Own notifications" on public.notifications
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Mark own notifications read" on public.notifications;
create policy "Mark own notifications read" on public.notifications
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Delete own notifications" on public.notifications;
create policy "Delete own notifications" on public.notifications
  for delete to authenticated
  using ((select auth.uid()) = user_id);

create or replace function private.notify_follow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, kind, actor_id) values (new.following_id, 'new_follower', new.follower_id);
  return new;
end;
$$;
revoke all on function private.notify_follow() from public, anon, authenticated;

drop trigger if exists notify_follow on public.follows;
create trigger notify_follow
  after insert on public.follows
  for each row execute function private.notify_follow();

create or replace function private.notify_comment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  to_user uuid;
begin
  if new.parent_id is not null then
    select c.author_id into to_user from public.comments c where c.id = new.parent_id;
    if to_user is not null and to_user <> new.author_id then
      insert into public.notifications (user_id, kind, actor_id, journey_id, comment_id)
      values (to_user, 'comment_reply', new.author_id, new.journey_id, new.id);
    end if;
  else
    select j.creator_id into to_user from public.journeys j where j.id = new.journey_id;
    if to_user is not null and to_user <> new.author_id then
      insert into public.notifications (user_id, kind, actor_id, journey_id, comment_id)
      values (to_user, 'new_comment', new.author_id, new.journey_id, new.id);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.notify_comment() from public, anon, authenticated;

drop trigger if exists notify_comment on public.comments;
create trigger notify_comment
  after insert on public.comments
  for each row execute function private.notify_comment();

-- publish_journey() writes 'journey_updated' notifications, so it can only be created once notifications exists.
-- It's a SECURITY DEFINER function in public (so the app can call it), which makes it callable by every role
-- by default: allow only signed-in people (the function itself checks they own the journey).
revoke all on function public.publish_journey(uuid, text) from public, anon, authenticated;
grant execute on function public.publish_journey(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Reports: anyone signed in can flag a journey or a comment; only admins read and resolve them.
-- -----------------------------------------------------------------------------
create table if not exists public.reports (
  id          bigint      generated always as identity primary key,
  reporter_id uuid        not null references auth.users (id) on delete cascade,
  journey_id  uuid        references public.journeys (id) on delete cascade,
  comment_id  uuid        references public.comments (id) on delete cascade,
  reason      text        not null check (char_length(reason) between 3 and 1000),
  status      text        not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at  timestamptz not null default now(),
  check (num_nonnulls(journey_id, comment_id) = 1)
);

create index if not exists reports_open_idx on public.reports (created_at desc) where status = 'open';
create index if not exists reports_reporter_idx on public.reports (reporter_id, created_at);
create index if not exists reports_journey_idx on public.reports (journey_id);
create index if not exists reports_comment_idx on public.reports (comment_id);

alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant insert (journey_id, comment_id, reason) on public.reports to authenticated;
grant select, update (status) on public.reports to authenticated;
grant all on public.reports to service_role;

drop policy if exists "Report content" on public.reports;
create policy "Report content" on public.reports
  for insert to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'open');

drop policy if exists "Admins read reports" on public.reports;
create policy "Admins read reports" on public.reports
  for select to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

drop policy if exists "Admins resolve reports" on public.reports;
create policy "Admins resolve reports" on public.reports
  for update to authenticated
  using (exists (select 1 from public.admins a where a.user_id = (select auth.uid())))
  with check (exists (select 1 from public.admins a where a.user_id = (select auth.uid())));

create or replace function private.report_defaults()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.reporter_id := coalesce((select auth.uid()), new.reporter_id);
  if (select count(*) from public.reports r where r.reporter_id = new.reporter_id and r.created_at > now() - interval '1 day') >= 20 then
    raise exception 'Too many reports today' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function private.report_defaults() from public, anon, authenticated;

drop trigger if exists report_defaults on public.reports;
create trigger report_defaults
  before insert on public.reports
  for each row execute function private.report_defaults();
