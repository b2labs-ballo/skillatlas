// SkillAtlas ingestion: finds public skills, plugins, MCP servers and GPTs on GitHub
// and saves them to the database. We only store metadata + README and always link
// back to the author. No code is copied or hosted.
//
// Usage:
//   node scripts/ingest.mjs            full run, saves to Supabase
//   node scripts/ingest.mjs --dry      saves to data/dry-run.json instead of the database
//   node scripts/ingest.mjs --quick    small sample (used automatically without a token)
//   node scripts/ingest.mjs --limit 50 process at most 50 repositories

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createGitHub, pool, RateLimitError } from "./lib/github.mjs";
import { categorize, decidePlatforms, decideType, extractInstallCommand, suspiciousReason } from "./lib/classify.mjs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_INGEST_TOKEN || "";
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const DRY = flag("dry") || !SUPABASE_URL || !SUPABASE_KEY;
const QUICK = flag("quick") || !TOKEN;
const LIMIT = Number(option("limit") || (QUICK ? 25 : 0));
const README_MAX = Number(process.env.README_MAX_CHARS || 20000);

const log = (...a) => console.log(...a);
const gh = createGitHub({ token: TOKEN, log });

// ---------------------------------------------------------------- sources

// GitHub topics → what a repo with that topic probably is.
const TOPICS = [
  ["claude-skills", "skill"], ["claude-skill", "skill"], ["agent-skills", "skill"], ["claude-code-skills", "skill"],
  ["claude-code-plugin", "plugin"], ["claude-code-plugins", "plugin"], ["claude-plugin", "plugin"], ["claude-plugins", "plugin"],
  ["mcp-server", "mcp"], ["mcp-servers", "mcp"], ["model-context-protocol", "mcp"],
  ["chatgpt-apps", "chatgpt-app"], ["chatgpt-app", "chatgpt-app"], ["apps-sdk", "chatgpt-app"],
  ["custom-gpt", "gpt"], ["custom-gpts", "gpt"], ["gpts", "gpt"],
  ["claude-code", "claude-code"],
];

// Extra name searches for skills/plugins that have no topic set.
const NAME_SEARCHES = [
  ["claude-skills in:name", "skill"], ["claude-skill in:name", "skill"], ["agent-skills in:name", "skill"],
  ["claude-code-plugin in:name", "plugin"], ["claude-plugin in:name", "plugin"], ["claude-plugins in:name", "plugin"],
];

// Code search: files that prove a repo is a skill or plugin. (Needs a token.)
const CODE_SEARCHES = [
  ["description filename:SKILL.md", "skillFiles"],
  ["name path:.claude-plugin filename:plugin.json", "pluginFiles"],
  ["plugins path:.claude-plugin filename:marketplace.json", "marketplace"],
];
const SIZE_SHARDS = ["<400", "400..800", "800..1300", "1300..2000", "2000..3000", "3000..4500", "4500..7000", "7000..12000", ">12000"];

// Curated lists. Each list is itself an entry (type: collection) and every GitHub
// repo / GPT it links to becomes a candidate.
const LISTS = [
  ["anthropics/skills", "skill"],
  ["anthropics/claude-plugins-official", "plugin"],
  ["anthropics/claude-plugins-community", "plugin"],
  ["ComposioHQ/awesome-claude-skills", "skill"],
  ["ComposioHQ/awesome-claude-plugins", "plugin"],
  ["travisvn/awesome-claude-skills", "skill"],
  ["BehiSecc/awesome-claude-skills", "skill"],
  ["VoltAgent/awesome-agent-skills", "skill"],
  ["ccplugins/awesome-claude-code-plugins", "plugin"],
  ["rdmgator12/awesome-chatgpt-apps", "chatgpt-app"],
  ["ai-boost/Awesome-GPTs", "gpt"],
  ["taranjeet/awesome-gpts", "gpt"],
];

const STAR_SHARDS = [">=1000", "200..999", "50..199", "20..49", "10..19", "5..9", "3..4", "2", "1", "0"];
const NOT_REPO_OWNERS = new Set([
  "topics", "sponsors", "orgs", "features", "marketplace", "apps", "user-attachments", "settings", "about", "search",
  "login", "join", "pricing", "collections", "trending", "issues", "pulls", "notifications", "site", "contact", "security", "users",
]);

// ---------------------------------------------------------------- discovery

/** candidates: lower-case "owner/repo" → { fullName, repo?, ev, foundVia } */
const candidates = new Map();
const gpts = new Map(); // "gpt:g-xxxx" → entry

function candidate(fullName) {
  const key = fullName.toLowerCase();
  if (!candidates.has(key)) {
    candidates.set(key, {
      fullName,
      repo: null,
      foundVia: new Set(),
      ev: { hints: new Set(), skillFiles: new Set(), pluginFiles: new Set(), marketplace: false },
    });
  }
  return candidates.get(key);
}

async function searchRepoPages(q, onRepo, maxPages = 10) {
  let total = 0;
  for (let page = 1; page <= maxPages; page++) {
    const data = await gh.get(`/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=100&page=${page}`, { bucket: "search" });
    if (!data?.items) break;
    total = data.total_count;
    data.items.forEach(onRepo);
    if (data.items.length < 100 || page * 100 >= Math.min(total, 1000)) break;
  }
  return total;
}

/** GitHub returns at most 1000 results per query, so big queries are split by stars (and year). */
async function searchReposSharded(q, onRepo) {
  if (QUICK) return searchRepoPages(q, onRepo, 1);
  const probe = await gh.get(`/search/repositories?q=${encodeURIComponent(q)}&per_page=1`, { bucket: "search" });
  const total = probe?.total_count ?? 0;
  if (total <= 1000) return searchRepoPages(q, onRepo);
  const thisYear = new Date().getUTCFullYear();
  for (const stars of STAR_SHARDS) {
    const qs = `${q} stars:${stars}`;
    const n = await searchRepoPages(qs, onRepo);
    if (n > 1000) {
      for (let y = 2022; y <= thisYear; y++) {
        const range = y === 2022 ? `<2023-01-01` : `${y}-01-01..${y}-12-31`;
        const ny = await searchRepoPages(`${qs} created:${range}`, onRepo);
        if (ny > 1000) {
          // Still too many in one year: split the year into months.
          for (let m = 1; m <= 12 && y > 2022; m++) {
            const mm = String(m).padStart(2, "0");
            const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
            await searchRepoPages(`${qs} created:${y}-${mm}-01..${y}-${mm}-${last}`, onRepo);
          }
        }
      }
    }
  }
  return total;
}

async function discoverByTopicsAndNames() {
  const searches = [
    ...TOPICS.map(([t, hint]) => [`topic:${t} archived:false`, hint, `topic:${t}`]),
    ...NAME_SEARCHES.map(([q, hint]) => [`${q} archived:false`, hint, `search:${q.split(" ")[0]}`]),
  ];
  for (const [q, hint, via] of QUICK ? searches.filter((_, i) => [0, 4, 8, 11, 14].includes(i)) : searches) {
    const before = candidates.size;
    const total = await searchReposSharded(q, (repo) => {
      const c = candidate(repo.full_name);
      c.repo = repo;
      c.ev.hints.add(hint);
      c.foundVia.add(via);
    });
    log(`  ${via}: ${total} on GitHub, ${candidates.size - before} new candidates`);
  }
}

async function discoverByCodeSearch() {
  if (!gh.authed) return log("  (code search skipped: needs a GitHub token)");
  for (const [q, kind] of CODE_SEARCHES) {
    let hits = 0;
    for (const size of QUICK ? [SIZE_SHARDS[2]] : SIZE_SHARDS) {
      for (let page = 1; page <= (QUICK ? 1 : 10); page++) {
        const data = await gh.get(`/search/code?q=${encodeURIComponent(`${q} size:${size}`)}&per_page=100&page=${page}`, { bucket: "code" });
        if (!data?.items?.length) break;
        for (const item of data.items) {
          const c = candidate(item.repository.full_name);
          if (kind === "marketplace") c.ev.marketplace = true;
          else c.ev[kind].add(item.path);
          c.foundVia.add(`code:${kind === "skillFiles" ? "SKILL.md" : kind === "pluginFiles" ? "plugin.json" : "marketplace.json"}`);
          hits++;
        }
        if (data.items.length < 100) break;
      }
    }
    log(`  code search "${q}": ${hits} files`);
  }
}

const cleanText = (s) =>
  s.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/<[^>]+>/g, "").replace(/[*_`|]/g, "").replace(/\s+/g, " ").trim();

function parseGptLinks(readme, listName) {
  for (const line of readme.split("\n")) {
    const re = /\[([^\]]+)\]\((https?:\/\/(?:chatgpt\.com|chat\.openai\.com)\/g\/(g-[A-Za-z0-9]+)([A-Za-z0-9-]*))[^)]*\)/g;
    let m;
    while ((m = re.exec(line))) {
      const [whole, label, , id, slugTail] = m;
      const key = `gpt:${id.toLowerCase()}`;
      const rest = cleanText(line.replace(whole, " ")).replace(/^[\s\-–—:•>#\d.]+/, "").trim();
      let name = cleanText(label);
      if (!name || /^(link|here|try it|chat|open|gpt|https?:)/i.test(name)) {
        name = slugTail.replace(/^-/, "").split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      }
      if (!name) continue;
      // "by [Name](https://their-site)" → credit the creator with a link when the list gives one.
      const byLink = line.match(/\bby\s+\[([^\]]{1,60})\]\((https?:\/\/[^)\s]+)\)/i);
      const by = byLink || rest.match(/\bby\s+@?([A-Za-z0-9][\w .'-]{1,40}?)(?=\s*[.,;)|]|\s+-|\s*$)/i);
      const existing = gpts.get(key);
      if (existing) {
        existing.found_via.push(`list:${listName}`);
        continue;
      }
      const description = rest.replace(/\s*\bby\s+[^.]{1,60}$/i, "").trim().slice(0, 400) || null;
      const base = { name, description, topics: [], readme: "", type: "gpt" };
      if (suspiciousReason({ ...base, stars: 99 })) continue;
      gpts.set(key, {
        slug: `gpt-${id.slice(2, 12).toLowerCase()}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50)}`,
        source_key: key,
        name: name.slice(0, 120),
        description,
        author: (by ? by[1].replace(/^[(@\s]+|[)\s]+$/g, "") : "") || "Unknown creator",
        author_url: byLink ? byLink[2] : null,
        author_avatar: null,
        platforms: ["chatgpt"],
        type: "gpt",
        github_url: null,
        homepage_url: `https://chatgpt.com/g/${id}${slugTail}`,
        stars: 0,
        last_updated: null,
        license: null,
        topics: [],
        readme: null,
        default_branch: null,
        install_command: null,
        ...categorize(base),
        found_via: [`list:${listName}`],
      });
    }
  }
}

async function discoverFromLists() {
  for (const [listName, hint] of QUICK ? LISTS.filter((_, i) => [0, 3, 11].includes(i)) : LISTS) {
    const self = candidate(listName);
    self.ev.hints.add("list");
    self.foundVia.add("list:self");
    const readme = await gh.get(`/repos/${listName}/readme`, { raw: true });
    if (!readme) {
      log(`  list ${listName}: could not read`);
      continue;
    }
    self.readme = readme;
    let repos = 0;
    // GPT lists: only the GPT links count; GitHub links there are usually unrelated tools.
    const repoLinks = hint === "gpt" ? [] : readme.matchAll(/https?:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/g);
    for (const m of repoLinks) {
      const owner = m[1];
      const name = m[2].replace(/\.git$/, "").replace(/[.]+$/, "");
      if (NOT_REPO_OWNERS.has(owner.toLowerCase()) || !name) continue;
      const full = `${owner}/${name}`;
      if (full.toLowerCase() === listName.toLowerCase()) continue;
      const c = candidate(full);
      c.ev.hints.add(hint);
      c.foundVia.add(`list:${listName}`);
      repos++;
    }
    const gptBefore = gpts.size;
    parseGptLinks(readme, listName);

    // Plugin marketplaces list their plugins in a machine-readable file.
    if (hint === "plugin" && !QUICK) {
      const mk = await gh.get(`/repos/${listName}/contents/.claude-plugin/marketplace.json`, { raw: true });
      try {
        for (const p of JSON.parse(mk || "{}").plugins || []) {
          const src = typeof p.source === "string" ? p.source : p.source?.repo || p.source?.url || "";
          const mm = String(src).match(/(?:github\.com\/)?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/);
          if (mm && !src.startsWith(".") && !src.startsWith("/")) {
            const c = candidate(`${mm[1]}/${mm[2]}`);
            c.ev.hints.add("plugin");
            c.foundVia.add(`list:${listName}`);
            repos++;
          }
        }
      } catch {
        /* not valid JSON – ignore */
      }
    }
    log(`  list ${listName}: ${repos} repo links, ${gpts.size - gptBefore} GPTs`);
  }
}

// ---------------------------------------------------------------- build entries

const stats = { saved: 0, unchanged: 0, skipped: {} };
const skip = (reason) => {
  stats.skipped[reason] = (stats.skipped[reason] || 0) + 1;
  return null;
};

async function buildEntry(c, existing) {
  const repo = c.repo || (await gh.get(`/repos/${c.fullName}`));
  if (!repo || !repo.full_name) return skip("not found");
  if (repo.private) return skip("private");
  if (repo.fork) return skip("fork");
  if (repo.archived || repo.disabled) return skip("archived");
  if (!repo.size) return skip("empty");

  const sourceKey = `gh:${repo.full_name.toLowerCase()}`;
  const topics = repo.topics || [];
  const base = { name: repo.name, description: repo.description, topics, ev: c.ev };
  const type = decideType(base);
  if (!type) return skip("not a skill/plugin/MCP");
  if (suspiciousReason({ ...base, readme: "", stars: repo.stargazers_count })) return skip("suspicious");

  // Unchanged since last run → keep the stored README, only refresh the numbers.
  const prev = existing.get(sourceKey);
  const unchanged = prev && prev.last_updated && new Date(prev.last_updated).getTime() === new Date(repo.pushed_at).getTime();
  let readme = c.readme ?? null;
  if (!unchanged && readme === null) readme = await gh.get(`/repos/${repo.full_name}/readme`, { raw: true });
  if (unchanged) {
    stats.unchanged++;
    return { partial: true, source_key: sourceKey, stars: repo.stargazers_count, topics, description: repo.description?.slice(0, 500) ?? null };
  }

  readme = (readme || "").replace(/\u0000/g, "");
  if (!readme.trim() && !repo.description) return skip("empty");
  if (suspiciousReason({ ...base, readme, stars: repo.stargazers_count })) return skip("suspicious");

  const homepage = repo.homepage && /^https?:\/\//.test(repo.homepage) && !repo.homepage.includes("github.com/" + repo.full_name) ? repo.homepage : null;
  return {
    slug: repo.full_name.toLowerCase().replace("/", "--").replace(/[^a-z0-9-]+/g, "-"),
    source_key: sourceKey,
    name: repo.name,
    description: repo.description?.slice(0, 500) ?? null,
    author: repo.owner.login,
    author_url: repo.owner.html_url,
    author_avatar: repo.owner.avatar_url,
    platforms: decidePlatforms({ ...base, type }),
    type,
    github_url: repo.html_url,
    homepage_url: homepage,
    stars: repo.stargazers_count,
    last_updated: repo.pushed_at,
    license: repo.license?.spdx_id && repo.license.spdx_id !== "NOASSERTION" ? repo.license.spdx_id : null,
    topics,
    readme: readme.slice(0, README_MAX) || null,
    default_branch: repo.default_branch,
    install_command: extractInstallCommand(readme, { type, fullName: repo.full_name, ev: c.ev }),
    ...categorize({ name: repo.name, description: repo.description, topics, readme, type }),
    found_via: [...c.foundVia].slice(0, 12),
  };
}

// ---------------------------------------------------------------- database

async function db(path, init = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`Database error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.status === 204 || res.headers.get("content-length") === "0" ? null : res.json().catch(() => null);
}

async function loadExisting() {
  const map = new Map();
  if (DRY) return map;
  for (let from = 0; ; from += 1000) {
    const rows = await db(`entries?select=source_key,last_updated&order=id`, { headers: { Range: `${from}-${from + 999}` } });
    for (const r of rows || []) map.set(r.source_key, r);
    if (!rows || rows.length < 1000) break;
  }
  return map;
}

async function saveBatch(rows) {
  const full = rows.filter((r) => !r.partial).map((r) => ({ ...r, ingested_at: new Date().toISOString() }));
  const upsert = (list) =>
    db(`entries?on_conflict=source_key`, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(list) });
  if (full.length) {
    try {
      await upsert(full);
    } catch {
      // One bad row must not lose the whole batch: save them one by one.
      for (const row of full) {
        await upsert([row]).catch((err) => log(`  could not save ${row.source_key}: ${err.message}`));
      }
    }
  }
  for (const r of rows.filter((r) => r.partial)) {
    await db(`entries?source_key=eq.${encodeURIComponent(r.source_key)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ stars: r.stars, topics: r.topics, description: r.description, ingested_at: new Date().toISOString() }),
    });
  }
}

// ---------------------------------------------------------------- main

async function main() {
  log(`SkillAtlas ingest — ${DRY ? "DRY RUN (no database)" : "saving to database"}${QUICK ? ", QUICK sample" : ""}${gh.authed ? "" : ", no GitHub token"}`);
  const started = Date.now();
  let rateLimited = false;

  try {
    log("1/4 Curated lists");
    await discoverFromLists();
    log("2/4 Topics and names");
    await discoverByTopicsAndNames();
    log("3/4 Code search");
    await discoverByCodeSearch();
  } catch (err) {
    if (!(err instanceof RateLimitError)) throw err;
    rateLimited = true;
    log(`  ${err.message}`);
  }

  // Repos we already have metadata for go first (they cost fewer API calls).
  let list = [...candidates.values()].sort((a, b) => (b.repo?.stargazers_count ?? -1) - (a.repo?.stargazers_count ?? -1));
  log(`4/4 Processing ${LIMIT ? `${Math.min(LIMIT, list.length)} of ` : ""}${list.length} candidate repositories and ${gpts.size} GPTs`);
  if (LIMIT) list = list.slice(0, LIMIT);

  const existing = await loadExisting();
  const seen = new Set();
  const output = [];
  let buffer = [];
  let done = 0;

  const flush = async (force) => {
    if (DRY || (!force && buffer.length < 100)) return;
    const rows = buffer;
    buffer = [];
    await saveBatch(rows);
  };

  try {
    await pool(list, gh.authed ? 4 : 1, async (c) => {
      const entry = await buildEntry(c, existing);
      done++;
      if (done % 250 === 0) log(`  …${done}/${list.length} (${gh.calls()} GitHub requests)`);
      if (!entry || seen.has(entry.source_key)) return; // renamed repos can appear twice
      seen.add(entry.source_key);
      stats.saved++;
      if (DRY) output.push(entry);
      else {
        buffer.push(entry);
        await flush(false);
      }
    });
  } catch (err) {
    if (!(err instanceof RateLimitError)) throw err;
    rateLimited = true;
    log(`  ${err.message}`);
  }

  const gptRows = (LIMIT ? [...gpts.values()].slice(0, LIMIT) : [...gpts.values()]).map((g) => ({ ...g, found_via: [...new Set(g.found_via)] }));
  const usedSlugs = new Set();
  for (const g of gptRows) {
    if (usedSlugs.has(g.slug)) continue;
    usedSlugs.add(g.slug);
    stats.saved++;
    if (DRY) output.push(g);
    else buffer.push(g);
  }
  await flush(true);

  if (DRY) {
    mkdirSync("data", { recursive: true });
    writeFileSync("data/dry-run.json", JSON.stringify(output, null, 1));
    log(`Wrote ${output.length} entries to data/dry-run.json`);
  }

  const byType = {};
  for (const e of output) byType[e.type] = (byType[e.type] || 0) + 1;
  log("\nSummary");
  log(`  entries saved:      ${stats.saved}${DRY ? ` ${JSON.stringify(byType)}` : ""}`);
  log(`  unchanged (kept):   ${stats.unchanged}`);
  log(`  skipped:            ${JSON.stringify(stats.skipped)}`);
  log(`  GitHub requests:    ${gh.calls()}`);
  log(`  time:               ${Math.round((Date.now() - started) / 1000)}s`);
  if (rateLimited) log("  NOTE: stopped early because of the GitHub rate limit.");
}

main().catch((err) => {
  console.error("Ingest failed:", err.message);
  process.exit(1);
});
