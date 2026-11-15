export function formatStars(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}k`;
  return String(n);
}

/**
 * A short, plain one-liner for the tiles: the first sentence of the creator's
 * description without links, emoji or markup, cut at a word if still too long.
 */
export function shortDescription(text: string | null, max = 110): string | null {
  if (!text) return null;
  let s = text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // links → their text
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/:[a-z0-9_+-]+:/g, " ") // :rocket:
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, " ")
    .replace(/[`*_#>|]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s\-–—:•·]+/, "")
    .trim();
  if (!s) return null;
  // First sentence: a full stop followed by a space and a capital letter (so "v1.2" or "e.g." don't end it).
  const end = s.search(/(?<=[^\s.]{2}[.!?])\s+(?=\p{Lu})/u);
  if (end >= 25) s = s.slice(0, end);
  if (s.length > max) {
    const cut = s.slice(0, max + 1);
    s = cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 25)).replace(/[\s,;:.\-–—(]+$/, "") + "…";
  }
  return s;
}

const dateFormat =new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
export function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : dateFormat.format(d);
}
