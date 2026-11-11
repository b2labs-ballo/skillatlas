-- SkillAtlas database update 002: more entry types and sources.
-- Paste this whole file into Supabase > SQL Editor > New query and press Run.
-- It is safe to run more than once and does not delete anything.

alter table public.entries drop constraint if exists entries_type_check;
alter table public.entries add constraint entries_type_check check (
  type in ('skill','plugin','collection','mcp','gpt','subagent','prompt','agent','local-app','extension','model')
);

alter table public.entries add column if not exists source     text not null default 'github'; -- github, list, openvsx, huggingface
alter table public.entries add column if not exists source_url text;                           -- the original page we link to
alter table public.entries add column if not exists downloads  bigint;                         -- downloads, where the source reports them
