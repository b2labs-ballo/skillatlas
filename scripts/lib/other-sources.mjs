// Sources other than GitHub search: the official MCP Registry, npm, Open VSX
// (editor extensions) and Hugging Face (models that run locally).
// Where an item has a GitHub repository we only add it as a GitHub candidate, so
// the same project never appears twice. Items without one become their own entry.

import { pool } from "./github.mjs";
import { categorize, decidePlatforms, suspiciousReason } from "./classify.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UA = { "User-Agent": "skillatlas-ingest" };

async function request(url, { text = false, headers = {} } = {}) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { ...UA, ...headers } });
      if (res.status === 429 || res.status >= 500) {
        await sleep(Number(res.headers.get("retry-after") || 0) * 1000 || 4000 * (attempt + 1));
        continue;
      }
      if (!res.ok) return null;
      return { body: text ? await res.text() : await res.json(), link: res.headers.get("link") };
    } catch {
      await sleep(3000 * (attempt + 1));
    }
  }
  return null;
}

const githubRepo = (url) => {
  const m = String(url || "").match(/github\.com[/:]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?(?:[/#?].*)?$/);
  return m ? `${m[1]}/${m[2]}` : null;
};
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Official MCP Registry: adds MCP servers and a reliable install command. */
export async function discoverMcpRegistry({ candidate, log, QUICK }) {
  let cursor = "";
  let withRepo = 0;
  let remoteOnly = 0;
  for (let page = 0; page < (QUICK ? 2 : 2000); page++) {
    const res = await request(`https://registry.modelcontextprotocol.io/v0/servers?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    const servers = res?.body?.servers;
    if (!servers?.length) break;
    for (const item of servers) {
      const meta = item._meta?.["io.modelcontextprotocol.registry/official"];
      if (!meta?.isLatest || (meta.status && meta.status !== "active")) continue;
      const server = item.server || {};
      const full = githubRepo(server.repository?.url);
      if (!full) {
        remoteOnly++;
        continue;
      }
      const c = candidate(full);
      c.ev.hints.add("mcp");
      c.foundVia.add("mcp-registry");
      const pkg = (server.packages || [])[0];
      if (pkg?.identifier && !c.installHint) {
        if (pkg.registryType === "npm") c.installHint = `npx -y ${pkg.identifier}`;
        else if (pkg.registryType === "pypi") c.installHint = `uvx ${pkg.identifier}`;
        else if (pkg.registryType === "oci") c.installHint = `docker run -i --rm ${pkg.identifier}`;
      }
      withRepo++;
    }
    cursor = res.body.metadata?.nextCursor;
    if (!cursor) break;
  }
  log(`  MCP Registry: ${withRepo} servers with a GitHub repository (${remoteOnly} hosted-only servers skipped)`);
}

/** npm: packages tagged as MCP servers / Claude plugins that point to a GitHub repository. */
export async function discoverNpm({ candidate, log, QUICK }) {
  const keywords = [["mcp-server", "mcp"], ["modelcontextprotocol", "mcp"], ["claude-code-plugin", "plugin"], ["claude-skills", "skill"]];
  for (const [kw, hint] of QUICK ? keywords.slice(0, 1) : keywords) {
    let found = 0;
    let total = 0;
    for (let from = 0; from < (QUICK ? 250 : 10000); from += 250) {
      const res = await request(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(`keywords:${kw}`)}&size=250&from=${from}`);
      const objects = res?.body?.objects;
      if (!objects?.length) break;
      total = res.body.total;
      for (const o of objects) {
        const full = githubRepo(o.package?.links?.repository);
        if (!full) continue;
        const c = candidate(full);
        c.ev.hints.add(hint);
        c.foundVia.add(`npm:${kw}`);
        if (hint === "mcp" && !c.installHint) c.installHint = `npx -y ${o.package.name}`;
        c.downloads = Math.max(c.downloads || 0, o.downloads?.monthly || 0) || null;
        found++;
      }
      if (from + 250 >= total) break;
      await sleep(400);
    }
    log(`  npm "${kw}": ${total} packages, ${found} with a GitHub repository`);
  }
}

/** Open VSX: AI extensions for VS Code-compatible editors. Returns ready entries for those without a GitHub repo. */
export async function discoverOpenVsx({ candidate, log, QUICK, README_MAX }) {
  const searches = ["category=AI", "query=claude", "query=chatgpt", "query=copilot", "query=llm", "query=mcp"];
  const MIN_DOWNLOADS = 1000;
  const found = new Map();
  for (const s of QUICK ? searches.slice(0, 1) : searches) {
    for (let offset = 0; offset < (QUICK ? 20 : 3000); offset += 100) {
      const res = await request(`https://open-vsx.org/api/-/search?${s}&size=${QUICK ? 20 : 100}&offset=${offset}&sortBy=downloadCount&sortOrder=desc`);
      const list = res?.body?.extensions;
      if (!list?.length) break;
      let enough = true;
      for (const e of list) {
        if (e.deprecated || (e.downloadCount || 0) < MIN_DOWNLOADS) {
          enough = false;
          continue;
        }
        found.set(`${e.namespace}.${e.name}`.toLowerCase(), e);
      }
      if (!enough || offset + 100 >= res.body.totalSize) break;
      await sleep(300);
    }
  }

  const entries = [];
  let onGithub = 0;
  await pool([...found.values()], 3, async (e) => {
    const detail = (await request(e.url))?.body;
    if (!detail) return;
    const page = `https://open-vsx.org/extension/${e.namespace}/${e.name}`;
    const full = githubRepo(detail.repository);
    if (full) {
      const c = candidate(full);
      c.ev.hints.add("extension");
      c.foundVia.add("openvsx");
      c.downloads = Math.max(c.downloads || 0, e.downloadCount || 0);
      c.altUrl = page;
      onGithub++;
      return;
    }
    const name = e.displayName || e.name;
    const base = { name, description: e.description || null, topics: (detail.tags || []).slice(0, 10), readme: "", type: "extension" };
    if (suspiciousReason({ ...base, stars: 99 })) return;
    const readme = detail.files?.readme ? ((await request(detail.files.readme, { text: true }))?.body ?? "") : "";
    entries.push({
      slug: `ovsx-${slugify(`${e.namespace}-${e.name}`)}`,
      source_key: `ovsx:${e.namespace}.${e.name}`.toLowerCase(),
      name: name.slice(0, 120),
      description: e.description?.slice(0, 500) ?? null,
      author: e.namespace,
      author_url: `https://open-vsx.org/namespace/${e.namespace}`,
      author_avatar: e.files?.icon ?? null,
      platforms: decidePlatforms({ ...base, ev: { hints: new Set(["extension"]), skillFiles: new Set(), pluginFiles: new Set() } }),
      type: "extension",
      github_url: null,
      homepage_url: null,
      stars: 0,
      last_updated: e.timestamp ?? null,
      license: detail.license ?? null,
      topics: base.topics,
      readme: readme.replace(/\u0000/g, "").slice(0, README_MAX) || null,
      default_branch: null,
      install_command: null,
      ...categorize({ ...base, readme }),
      found_via: ["openvsx"],
      source: "openvsx",
      source_url: page,
      downloads: e.downloadCount ?? null,
    });
  });
  log(`  Open VSX: ${found.size} AI extensions (${onGithub} linked to GitHub, ${entries.length} added directly)`);
  return entries;
}

const HF_SKIP_TAG = /^(region:|license:|endpoints_compatible|autotrain_compatible|base_model:|arxiv:|doi:|dataset:|text-generation-inference|imatrix)/;

/** Hugging Face: the most downloaded text models in GGUF format (the format local apps like Ollama use). */
export async function discoverHuggingFace({ log, QUICK, README_MAX }) {
  const models = [];
  let url = `https://huggingface.co/api/models?filter=gguf&pipeline_tag=text-generation&sort=downloads&direction=-1&limit=${QUICK ? 8 : 100}&full=true`;
  for (let page = 0; url && page < (QUICK ? 1 : 10); page++) {
    const res = await request(url);
    if (!Array.isArray(res?.body)) break;
    models.push(...res.body.filter((m) => !m.private && !m.disabled && m.id?.includes("/")));
    url = res.link?.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
  }

  const entries = [];
  await pool(models, 4, async (m) => {
    const [author, name] = m.id.split("/");
    const raw = (await request(`https://huggingface.co/${m.id}/raw/main/README.md`, { text: true }))?.body ?? "";
    const readme = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "").replace(/\u0000/g, "");
    const firstParagraph = readme
      .split(/\r?\n\s*\r?\n/)
      .map((p) => p.replace(/<[^>]+>/g, "").replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[#*_`>|]/g, "").replace(/\s+/g, " ").trim())
      .find((p) => p.length > 60);
    const tags = (m.tags || []).filter((t) => !HF_SKIP_TAG.test(t)).slice(0, 10);
    const description = (firstParagraph || "A GGUF model you can run on your own computer with Ollama, LM Studio or llama.cpp.").slice(0, 400);
    const base = { name, description, topics: tags, readme, type: "model" };
    if (suspiciousReason({ ...base, stars: 99 })) return;
    entries.push({
      slug: `hf-${slugify(m.id.replace("/", "--"))}`,
      source_key: `hf:${m.id.toLowerCase()}`,
      name: name.slice(0, 120),
      description,
      author,
      author_url: `https://huggingface.co/${author}`,
      author_avatar: null,
      platforms: ["local"],
      type: "model",
      github_url: null,
      homepage_url: null,
      stars: m.likes || 0,
      last_updated: m.lastModified ?? null,
      license: (m.tags || []).find((t) => t.startsWith("license:"))?.slice(8) ?? null,
      topics: tags,
      readme: readme.slice(0, README_MAX) || null,
      default_branch: null,
      install_command: `ollama run hf.co/${m.id}`,
      ...categorize(base),
      found_via: ["huggingface"],
      source: "huggingface",
      source_url: `https://huggingface.co/${m.id}`,
      downloads: m.downloads ?? null,
    });
  });
  log(`  Hugging Face: ${entries.length} local models`);
  return entries;
}
