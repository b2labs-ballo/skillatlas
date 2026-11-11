// Values that are safe to use in the browser: the public database address and
// the public (read-only) key.

export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const PAGE_SIZE = 24;
export const CARD_COLUMNS =
  "slug,name,description,author,author_avatar,platforms,type,stars,last_updated,professions,tasks";

export type EntryCardData = {
  slug: string;
  name: string;
  description: string | null;
  author: string;
  author_avatar: string | null;
  platforms: string[];
  type: string;
  stars: number;
  last_updated: string | null;
  professions: string[];
  tasks: string[];
};
