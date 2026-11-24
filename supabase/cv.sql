-- =============================================================================
-- Track My Roadmap: CV Builder.
--
-- Run AFTER supabase/schema.sql. Supabase → SQL Editor → New query → paste → Run. Safe to re-run.
-- Adds new objects only; nothing existing is changed or dropped.
--
-- A CV is private: each person can only see and change their own rows (row level security), and the API
-- also filters every query by the signed-in user's id. `data` holds the CV content in the JSON Resume shape
-- (see lib/cv/schema.ts), validated on the server before every write.
-- =============================================================================

create table if not exists public.cvs (
  id               uuid        primary key default gen_random_uuid(),
  user_id          uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  title            text        not null default 'My CV' check (char_length(title) between 1 and 80),
  template_id      text        not null default 'classic' check (template_id ~ '^[a-z0-9-]{1,30}$'),
  page_size        text        not null default 'a4' check (page_size in ('a4', 'letter')),
  data             jsonb       not null default '{}' check (octet_length(data::text) <= 200000),
  source_file_path text        check (char_length(source_file_path) <= 300),  -- the uploaded original (phase 2)
  is_primary       boolean     not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists cvs_user_idx on public.cvs (user_id, updated_at desc);
-- at most one primary CV per person
create unique index if not exists cvs_one_primary on public.cvs (user_id) where is_primary;

alter table public.cvs enable row level security;
revoke all on public.cvs from anon;
grant select, insert, update, delete on public.cvs to authenticated;

drop policy if exists "Own CVs" on public.cvs;
create policy "Own CVs" on public.cvs
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- updated_at is set by the database, so the browser can't fake it
create or replace function public.cvs_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.cvs_touch() from public, anon, authenticated;

drop trigger if exists cvs_touch on public.cvs;
create trigger cvs_touch
  before update on public.cvs
  for each row execute function public.cvs_touch();

-- At most 20 CVs per person, so one account can't fill the database.
create or replace function public.limit_cvs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.cvs c where c.user_id = new.user_id) >= 20 then
    raise exception 'Too many CVs for one account' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function public.limit_cvs() from public, anon, authenticated;

drop trigger if exists limit_cvs on public.cvs;
create trigger limit_cvs
  before insert on public.cvs
  for each row execute function public.limit_cvs();

-- ---------------------------------------------------------------------------
-- Check that one person can't read another's CV (run in the SQL Editor after creating two test accounts;
-- replace the ids). Each select should return only that person's rows.
--   begin;
--   set local role authenticated;
--   set local request.jwt.claims = '{"sub":"<user A id>"}';
--   select id, title from public.cvs;          -- only A's CVs
--   set local request.jwt.claims = '{"sub":"<user B id>"}';
--   select id, title from public.cvs;          -- only B's CVs
--   rollback;
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Uploaded CVs (phase 2): the original PDF/DOCX someone imports, kept privately.
-- Files live at cv-uploads/<user id>/<cv id>/original.<pdf|docx>, or <user id>/pending/<upload id>.<ext> between
-- reading a file and saving the CV. Each person can only reach files in their own folder. Safe to re-run.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cv-uploads', 'cv-uploads', false, 5242880,
        array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Own CV uploads: read" on storage.objects;
create policy "Own CV uploads: read" on storage.objects
  for select to authenticated
  using (bucket_id = 'cv-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Own CV uploads: add" on storage.objects;
create policy "Own CV uploads: add" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'cv-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- moving a file from pending/ to the CV's folder is an update
drop policy if exists "Own CV uploads: move" on storage.objects;
create policy "Own CV uploads: move" on storage.objects
  for update to authenticated
  using (bucket_id = 'cv-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'cv-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Own CV uploads: remove" on storage.objects;
create policy "Own CV uploads: remove" on storage.objects
  for delete to authenticated
  using (bucket_id = 'cv-uploads' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- ATS checks (phase 3): a CV checked against a job description. Deleted with the CV. Safe to re-run.
-- `keywords` are the terms read from the job description, kept so the score can be recalculated as the CV
-- changes without asking the AI again.
-- ---------------------------------------------------------------------------
create table if not exists public.cv_checks (
  id               uuid        primary key default gen_random_uuid(),
  cv_id            uuid        not null references public.cvs (id) on delete cascade,
  user_id          uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  job_title        text        check (char_length(job_title) <= 120),
  job_description  text        not null check (char_length(job_description) between 50 and 15000),
  keywords         jsonb       not null default '[]' check (octet_length(keywords::text) <= 20000),
  score            smallint    not null check (score between 0 and 100),
  missing_keywords jsonb       not null default '[]' check (octet_length(missing_keywords::text) <= 20000),
  suggestions      jsonb       not null default '[]' check (octet_length(suggestions::text) <= 40000),
  created_at       timestamptz not null default now()
);

create index if not exists cv_checks_cv_idx on public.cv_checks (cv_id, created_at desc);
create index if not exists cv_checks_user_idx on public.cv_checks (user_id);

alter table public.cv_checks enable row level security;
revoke all on public.cv_checks from anon;
grant select, insert, delete on public.cv_checks to authenticated;

drop policy if exists "Own CV checks" on public.cv_checks;
create policy "Own CV checks" on public.cv_checks
  for all to authenticated
  using ((select auth.uid()) = user_id)
  -- a check can only be added to one of your own CVs
  with check ((select auth.uid()) = user_id
              and exists (select 1 from public.cvs c where c.id = cv_id and c.user_id = (select auth.uid())));

-- ---------------------------------------------------------------------------
-- Share links (phase 4). Off by default: share_token is null until the owner turns sharing on, and setting it
-- back to null turns the link off for good (turning it on again makes a new link). Safe to re-run.
-- Visitors can't read the cvs table at all; the shared page calls shared_cv(), which returns only the CV
-- content for an exact token match.
-- ---------------------------------------------------------------------------
alter table public.cvs add column if not exists share_token text check (share_token ~ '^[A-Za-z0-9_-]{24,64}$');
create unique index if not exists cvs_share_token on public.cvs (share_token) where share_token is not null;

create or replace function public.shared_cv(p_token text)
returns table (data jsonb, page_size text, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.data, c.page_size, c.updated_at
  from public.cvs c
  where p_token ~ '^[A-Za-z0-9_-]{24,64}$' and c.share_token = p_token
  limit 1;
$$;
revoke all on function public.shared_cv(text) from public;
grant execute on function public.shared_cv(text) to anon, authenticated;
