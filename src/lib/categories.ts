import data from "./categories.json";

export type Option = { slug: string; label: string };

export const PLATFORMS: Option[] = data.platforms;
export const TYPES: Option[] = data.types;
export const PROFESSIONS: Option[] = data.professions.map(({ slug, label }) => ({ slug, label }));
export const TASKS: Option[] = data.tasks.map(({ slug, label }) => ({ slug, label }));

export const SORTS: Option[] = [
  { slug: "stars", label: "Most stars" },
  { slug: "newest", label: "Recently updated" },
];

const labels = new Map<string, string>(
  [...PLATFORMS, ...TYPES, ...PROFESSIONS, ...TASKS].map((o) => [o.slug, o.label]),
);
/** Short label used on cards (the MCP label is long). */
export const label = (slug: string) => (slug === "mcp" ? "MCP" : (labels.get(slug) ?? slug));

export const isValid = (list: Option[], value: string | undefined): value is string =>
  !!value && list.some((o) => o.slug === value);
