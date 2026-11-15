-- SkillAtlas: visit counter, download counter and the feedback form.
-- Run once in Supabase > SQL Editor. It only adds three small tables and four
-- functions; it does not touch the entries.

-- One row per day: how many visits and how many download clicks.
create table if not exists public.site_stats (
  day        date primary key default current_date,
  visits     bigint not null default 0,
  downloads  bigint not null default 0
);

-- How many times "Download ZIP" was clicked for each entry.
create table if not exists public.entry_downloads (
  slug       text primary key,
  downloads  bigint not null default 0,
  last_at    timestamptz not null default now()
);

-- Messages from the feedback form. Read them in Table Editor > feedback.
create table if not exists public.feedback (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  message     text not null check (char_length(message) between 3 and 3000),
  contact     text check (char_length(contact) <= 200),
  page        text check (char_length(page) <= 300)
);

alter table public.site_stats      enable row level security;
alter table public.entry_downloads enable row level security;
alter table public.feedback        enable row level security;

-- Counters are public numbers. Feedback has no policy: visitors cannot read it.
drop policy if exists "Public can read site stats" on public.site_stats;
create policy "Public can read site stats" on public.site_stats for select using (true);
drop policy if exists "Public can read download counts" on public.entry_downloads;
create policy "Public can read download counts" on public.entry_downloads for select using (true);

-- Visitors cannot write to the tables directly; they can only call these functions.
create or replace function public.track_visit() returns void
language sql security definer set search_path = '' as $$
  insert into public.site_stats (day, visits) values (current_date, 1)
  on conflict (day) do update set visits = public.site_stats.visits + 1;
$$;

create or replace function public.track_download(p_slug text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.entries where slug = p_slug and status = 'published') then
    return;
  end if;
  insert into public.entry_downloads (slug, downloads) values (p_slug, 1)
  on conflict (slug) do update set downloads = public.entry_downloads.downloads + 1, last_at = now();
  insert into public.site_stats (day, downloads) values (current_date, 1)
  on conflict (day) do update set downloads = public.site_stats.downloads + 1;
end;
$$;

create or replace function public.send_feedback(p_message text, p_contact text default null, p_page text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_message is null or char_length(btrim(p_message)) < 3 then
    raise exception 'Message is too short';
  end if;
  -- Simple flood protection: at most 60 messages an hour in total.
  if (select count(*) from public.feedback where created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Too many messages right now, please try again later';
  end if;
  insert into public.feedback (message, contact, page)
  values (left(btrim(p_message), 3000), nullif(left(btrim(coalesce(p_contact, '')), 200), ''), nullif(left(coalesce(p_page, ''), 300), ''));
end;
$$;

create or replace function public.site_totals() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object('visits', coalesce(sum(visits), 0), 'downloads', coalesce(sum(downloads), 0)) from public.site_stats;
$$;

revoke all on function public.track_visit(), public.track_download(text), public.send_feedback(text, text, text), public.site_totals() from public;
grant execute on function public.track_visit(), public.track_download(text), public.send_feedback(text, text, text), public.site_totals() to anon, authenticated;

-- Tell the API about the new tables and functions.
notify pgrst, 'reload schema';
