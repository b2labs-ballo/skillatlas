// Rules that decide: what type an entry is, which platforms it is for,
// which profession/task categories it belongs to, how to install it,
// and whether it looks suspicious and should be skipped.

import { readFileSync } from "node:fs";

const categories = JSON.parse(
  readFileSync(new URL("../../src/lib/categories.json", import.meta.url), "utf8"),
);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const compile = (list) =>
  list.map((c) => ({
    slug: c.slug,
    patterns: c.keywords.map((k) => new RegExp(`(^|[^a-z0-9])${escapeRe(k)}([^a-z0-9]|$)`, "g")),
  }));
const PROFESSIONS = compile(categories.professions);
const TASKS = compile(categories.tasks);

function score(groups, strong, weak) {
  const out = [];
  for (const g of groups) {
    let s = 0;
    for (const re of g.patterns) {
      re.lastIndex = 0;
      if (re.test(strong)) s += 3;
      re.lastIndex = 0;
      if (re.test(weak)) s += 1; // README mentions count once per keyword
    }
    if (s > 0) out.push({ slug: g.slug, s });
  }
  return out.sort((a, b) => b.s - a.s);
}

/** Assign up to 3 professions and up to 3 tasks using keyword rules. */
export function categorize({ name, description, topics, readme, type }) {
  const strong = `${name} ${description || ""} ${(topics || []).join(" ")}`.toLowerCase().replace(/[-_]/g, " ");
  const weak = (readme || "").slice(0, 4000).toLowerCase();

  let professions = score(PROFESSIONS, strong, weak).filter((x) => x.s >= 3).slice(0, 3).map((x) => x.slug);
  let tasks = score(TASKS, strong, weak).filter((x) => x.s >= 3).slice(0, 3).map((x) => x.slug);

  if (professions.length === 0) professions = [type === "mcp" || type === "plugin" ? "developers" : "everyone"];
  if (type === "collection" && !tasks.includes("discovery")) tasks = ["discovery", ...tasks].slice(0, 3);
  if (tasks.length === 0) tasks = [type === "plugin" ? "coding" : "automation"];
  return { professions, tasks };
}

const SUSPICIOUS = new RegExp(
  [
    "crack(ed)?\\b", "keygen", "aimbot", "\\bcheats?\\b", "stealer", "drainer", "free[- ]?robux",
    "nitro[- ]?gen", "hack(ed)?[- ]?(tool|account)", "licen[sc]e[- ]?bypass", "bypass[- ]?licen[sc]e",
    "\\bactivator\\b", "seed[- ]?phrase", "\\bairdrop\\b", "jailbreak", "leaked[- ]?prompts?",
    "\\bundetected\\b", "wallet[- ]?recovery", "\\bexecutor\\b.*roblox", "premium[- ]?unlock",
  ].join("|"),
  "i",
);

/** Returns a reason string when the repo should be skipped, otherwise null. */
export function suspiciousReason({ name, description, readme, stars }) {
  const head = `${name} ${description || ""}`;
  if (SUSPICIOUS.test(head)) return "suspicious keywords";
  const top = (readme || "").slice(0, 2500);
  // Classic malware pattern: unknown repo whose README mainly pushes a zip/exe download.
  if (stars < 10 && /download/i.test(top) && /\.(zip|rar|exe|msi|dmg)\b/i.test(top) && /releases\/download|raw\/|\?raw=true/i.test(top)) {
    return "pushes binary download";
  }
  return null;
}

/**
 * Decide the entry type from the evidence collected during discovery.
 * Returns null when we cannot tell that the repo is a skill/plugin/MCP/GPT at all.
 */
export function decideType({ name, description, topics, ev }) {
  const text = `${name} ${description || ""} ${(topics || []).join(" ")}`.toLowerCase();
  const plugins = ev.pluginFiles.size;
  const skills = ev.skillFiles.size;

  if (ev.hints.has("list") || /(^|[^a-z])awesome[-_ ]/.test(name.toLowerCase())) return "collection";
  if (plugins > 1 || (ev.marketplace && plugins !== 1)) return "collection";
  if (plugins === 1) return "plugin";
  if (skills > 1) return "collection";
  if (skills === 1) return "skill";
  if (ev.hints.has("mcp") || ev.hints.has("chatgpt-app") || /\bmcp\b|model context protocol/.test(text)) return "mcp";
  if (ev.hints.has("plugin")) return "plugin";
  if (ev.hints.has("skill")) return /skills\b.*(collection|library|pack)|collection of/.test(text) ? "collection" : "skill";
  if (ev.hints.has("gpt")) return "gpt";
  // Only tagged "claude-code": keep it just when the text says what it is.
  if (/\bplugins?\b/.test(text)) return "plugin";
  if (/\bskills?\b/.test(text)) return "skill";
  return null;
}

export function decidePlatforms({ type, name, description, topics, ev }) {
  const text = `${name} ${description || ""} ${(topics || []).join(" ")}`.toLowerCase();
  const mentionsChatgpt = /chatgpt|openai|\bgpts?\b|codex/.test(text) || ev.hints.has("chatgpt-app") || ev.hints.has("gpt");
  const mentionsClaude = /claude|anthropic/.test(text) || ev.hints.has("skill") || ev.hints.has("plugin") || ev.hints.has("claude-code");
  if (type === "gpt") return ["chatgpt"];
  if (type === "mcp") {
    // MCP servers work in both; ChatGPT-app repos that never mention Claude are ChatGPT only.
    return ev.hints.has("chatgpt-app") && !mentionsClaude ? ["chatgpt"] : ["claude", "chatgpt"];
  }
  if (type === "collection") {
    if (mentionsChatgpt && !mentionsClaude) return ["chatgpt"];
    return mentionsChatgpt ? ["claude", "chatgpt"] : ["claude"];
  }
  return mentionsChatgpt && !ev.skillFiles.size && !ev.pluginFiles.size && !mentionsClaude ? ["chatgpt"] : mentionsChatgpt ? ["claude", "chatgpt"] : ["claude"];
}

const INSTALL_PATTERNS = [
  /^\/plugin marketplace add \S+.*$/,
  /^\/plugin install \S+.*$/,
  /^claude plugin (marketplace add|install) \S+.*$/,
  /^claude mcp add .+$/,
  /^npx (-y |--yes )?(skills|@?[\w./@-]*skills?[\w./@-]*) (add|install) .+$/,
  /^npx (-y |--yes )?[@\w][\w./@-]+.*$/,
  /^uvx [\w@][\w./@=-]+.*$/,
  /^(pip|pipx|uv tool|uv pip) install [\w@][^\s]*.*$/,
  /^npm (install|i) (-g|--global) [@\w][\w./@-]+.*$/,
  /^docker run .+$/,
  /^brew install [\w./@-]+.*$/,
  /^go install [\w./@-]+.*$/,
  /^cargo install [\w./@-]+.*$/,
];

/** Find the most useful install command inside the README's code blocks. */
export function extractInstallCommand(readme, { type, fullName, ev }) {
  // A curated list's README is full of other people's commands – don't present one as its own.
  const isList = type === "collection" && ev?.hints.has("list");
  if (readme && !isList) {
    const lines = [];
    const blockRe = /```[^\n]*\n([\s\S]*?)```/g;
    let m;
    while ((m = blockRe.exec(readme)) && lines.length < 400) {
      for (const l of m[1].split("\n")) lines.push(l.trim().replace(/^[$>]\s+/, "").replace(/\s+#\s.*$/, "").trim());
    }
    for (const im of readme.matchAll(/`([^`\n]{8,160})`/g)) lines.push(im[1].trim());
    // Skip multi-line commands and ones with placeholders like <your-username>.
    const usable = (l) => l.length <= 200 && !l.endsWith("\\") && !/[<>]|your[-_ ]|\.\.\.|example\.com/i.test(l);
    for (const re of INSTALL_PATTERNS) {
      const hit = lines.find((l) => usable(l) && re.test(l));
      if (hit) return hit;
    }
  }
  if (fullName && ev?.marketplace) return `/plugin marketplace add ${fullName}`;
  return null;
}
