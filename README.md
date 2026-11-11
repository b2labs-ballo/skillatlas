# SkillAtlas

A public directory of skills, plugins, MCP servers, coding agents, prompts, local apps and models for Claude, ChatGPT and other AI tools.

SkillAtlas only **links to and credits** the original creators. It never copies or hosts anyone's code: every entry points back to its source (GitHub, Open VSX, Hugging Face or the creator's site).

## How it works

- **Website** – Next.js (`src/`). Reads published entries from the database with a public read-only key.
- **Database** – Supabase (Postgres). Schema in `supabase/schema.sql`, later changes in `supabase/migration-*.sql`.
- **Ingestion** – `scripts/ingest.mjs` collects entries from GitHub (curated lists, topics, code search), the official MCP Registry, npm, Open VSX and Hugging Face. It skips forks, archived, empty and suspicious repositories and assigns type, platform, profession and task with simple rules.
- **Daily refresh** – `.github/workflows/ingest.yml` runs the ingestion every day.

## Running it yourself

1. Copy `.env.example` to `.env.local` and fill in the keys (GitHub token, Supabase URL and keys).
2. In Supabase, run `supabase/schema.sql` (and any `migration-*.sql` files) in the SQL Editor.
3. `npm install`
4. `node scripts/check-setup.mjs` – checks that the keys work.
5. `npm run ingest` – fills the database (`npm run ingest:dry` writes to `data/dry-run.json` instead).
6. `npm run dev` – opens the site on http://localhost:3000.

## Removing or correcting an entry

If you are the creator of something listed here and want it changed or removed, open an issue in this repository.
