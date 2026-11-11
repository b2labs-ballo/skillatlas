// Read-only access to the public database (Supabase REST API).
// Uses the public "anon/publishable" key, which can only read published entries.

import { cacheLife } from "next/cache";
import { isValid, PLATFORMS, PROFESSIONS, TASKS, TYPES } from "./categories";

import { CARD_COLUMNS, type EntryCardData, PAGE_SIZE, SUPABASE_ANON_KEY, SUPABASE_URL } from "./public-db";

export { PAGE_SIZE, type EntryCardData };

export type Entry = EntryCardData & {
  author_url: string | null;
  github_url: string | null;
  homepage_url: string | null;
  license: string | null;
  topics: string[];
  readme: string | null;
  default_branch: string | null;
  install_command: string | null;
  found_via: string[];
};

export type ListParams = {
  q?: string;
  platform?: string;
  type?: string;
  profession?: string;
  task?: string;
  sort?: string;
  page?: number;
};

/** Turn what the visitor typed into a safe full-text query; the last word matches as a prefix. */
export function toTsQuery(q: string): string | null {
  const words = q.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.slice(0, 8) ?? [];
  if (words.length === 0) return null;
  return words.map((w, i) => (i === words.length - 1 ? `${w}:*` : w)).join(" & ");
}

export function buildListQuery(p: ListParams): URLSearchParams {
  const qs = new URLSearchParams({ select: CARD_COLUMNS });
  const ts = p.q ? toTsQuery(p.q) : null;
  if (ts) qs.set("search", `fts(english).${ts}`);
  if (isValid(PLATFORMS, p.platform)) qs.set("platforms", `cs.{${p.platform}}`);
  if (isValid(TYPES, p.type)) qs.set("type", `eq.${p.type}`);
  if (isValid(PROFESSIONS, p.profession)) qs.set("professions", `cs.{${p.profession}}`);
  if (isValid(TASKS, p.task)) qs.set("tasks", `cs.{${p.task}}`);
  qs.set("order", p.sort === "newest" ? "last_updated.desc.nullslast,id.asc" : "stars.desc,id.asc");
  const page = Math.max(1, Math.min(p.page ?? 1, 2000));
  qs.set("limit", String(PAGE_SIZE));
  qs.set("offset", String((page - 1) * PAGE_SIZE));
  return qs;
}

async function query<T>(path: string, headers: Record<string, string> = {}): Promise<{ rows: T[]; total: number | null }> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Database keys are missing (.env.local).");
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_ANON_KEY, ...headers },
  });
  if (!res.ok && res.status !== 416) throw new Error(`Database error ${res.status}`);
  const rows = res.status === 416 ? [] : ((await res.json()) as T[]);
  const total = Number(res.headers.get("content-range")?.split("/")[1]);
  return { rows, total: Number.isFinite(total) ? total : null };
}

// Results are cached for a few minutes per distinct query, so repeat visits are instant.
export async function listEntries(p: ListParams) {
  "use cache";
  cacheLife("minutes");
  const { rows, total } = await query<EntryCardData>(`entries?${buildListQuery(p)}`, { Prefer: "count=exact" });
  return { entries: rows, total: total ?? rows.length };
}

export async function getEntry(slug: string): Promise<Entry | null> {
  "use cache";
  cacheLife("minutes");
  const qs = new URLSearchParams({ select: "*", slug: `eq.${slug}`, limit: "1" });
  const { rows } = await query<Entry>(`entries?${qs}`);
  return rows[0] ?? null;
}
