-- SkillAtlas database schema.
-- Paste this whole file into Supabase > SQL Editor > New query and press Run.
-- It is safe to run more than once.

create table if not exists public.entries (
  id              bigint generated always as identity primary key,
  slug            text not null unique,          -- used in the page address, e.g. /e/anthropics--skills
  source_key      text not null unique,          -- deduplication key: "gh:owner/repo" or "gpt:g-xxxx"
  name            text not null,
  description     text,
  author          text not null,                 -- always credited
  author_url      text,
  author_avatar   text,
  platforms       text[] not null default '{}',  -- claude, chatgpt
  type            text not null check (type in ('skill','plugin','collection','mcp','gpt')),
  github_url      text,
  homepage_url    text,                          -- creator's site (or the GPT link)
  stars           integer not null default 0,
  last_updated    timestamptz,
  license         text,
  topics          text[] not null default '{}',
  readme          text,
  default_branch  text,
  install_command text,
  professions     text[] not null default '{}',
  tasks           text[] not null default '{}',
  found_via       text[] not null default '{}',  -- where we discovered it (topic, list, code search)
  status          text not null default 'published' check (status in ('published','hidden')),
  created_at      timestamptz not null default now(),
  ingested_at     timestamptz not null default now(),
  search          tsvector generated always as (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(author, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', left(coalesce(readme, ''), 8000)), 'C')
  ) stored
);

create index if not exists entries_search_idx      on public.entries using gin (search);
create index if not exists entries_platforms_idx   on public.entries using gin (platforms);
create index if not exists entries_professions_idx on public.entries using gin (professions);
create index if not exists entries_tasks_idx       on public.entries using gin (tasks);
create index if not exists entries_type_idx        on public.entries (type);
create index if not exists entries_stars_idx       on public.entries (stars desc);
create index if not exists entries_updated_idx     on public.entries (last_updated desc nulls last);

-- Visitors may only READ published entries. Writing is possible only with the
-- secret "service role" key, which the daily ingestion job uses.
alter table public.entries enable row level security;

drop policy if exists "Public can read published entries" on public.entries;
create policy "Public can read published entries"
  on public.entries for select
  to anon, authenticated
  using (status = 'published');
