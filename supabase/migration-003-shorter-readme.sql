-- SkillAtlas: make the database smaller (free plan allows 500 MB).
-- GitHub entries keep only the opening 1,000 characters of the README.
-- The website shows the full, current README live from GitHub, so nothing
-- disappears from the pages.
--
-- Run this file in Supabase > SQL Editor. It can take a few minutes.
-- Afterwards run the single line from migration-003b-reclaim-space.sql.

set statement_timeout = '30min';

update public.entries
   set readme = left(readme, 1000)
 where github_url like 'https://github.com/%'
   and length(readme) > 1000;
