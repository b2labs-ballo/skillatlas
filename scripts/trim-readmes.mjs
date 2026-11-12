// One-off clean-up: shortens the stored README of GitHub entries to its opening
// characters, in small batches, so the database fits the free plan.
// Safe to stop and start again.  Run:  node scripts/trim-readmes.mjs

import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const URL_ = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const KEEP = Number(process.env.README_KEEP_GITHUB || 1000);
if (!URL_ || !KEY) {
  console.error("Missing database keys in .env.local");
  process.exit(1);
}
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(path, init = {}) {
  const waits = [5, 20, 60, 180, 300];
  for (let attempt = 0; ; attempt++) {
    let message;
    try {
      const res = await fetch(`${URL_}/rest/v1/${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
      if (res.ok) return res.status === 204 ? null : res.json().catch(() => null);
      message = `Database error ${res.status}: ${(await res.text()).slice(0, 200)}`;
      if (res.status < 500 && res.status !== 429 && res.status !== 408) throw new Error(message);
    } catch (err) {
      if (err.message === message) throw err;
      message = message || `Database not reachable: ${err.message}`;
    }
    if (attempt >= waits.length) throw new Error(message);
    console.log(`  database busy, trying again in ${waits[attempt]}s…`);
    await sleep(waits[attempt] * 1000);
  }
}

let lastId = Number(process.argv[2] || 0);
let seen = 0;
let trimmed = 0;
for (;;) {
  const rows = await call(`entries?select=id,source_key,slug,name,author,type,github_url,readme&id=gt.${lastId}&order=id&limit=100`);
  if (!rows || rows.length === 0) break;
  lastId = rows[rows.length - 1].id;
  seen += rows.length;
  const updates = rows
    .filter((r) => (r.github_url || "").startsWith("https://github.com/") && (r.readme || "").length > KEEP)
    // slug, name, author and type are included only because the database requires them on every write.
    .map((r) => ({ source_key: r.source_key, slug: r.slug, name: r.name, author: r.author, type: r.type, readme: r.readme.slice(0, KEEP) }));
  for (let i = 0; i < updates.length; i += 25) {
    await call("entries?on_conflict=source_key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(updates.slice(i, i + 25)),
    });
  }
  trimmed += updates.length;
  if (seen % 1000 === 0) console.log(`…${seen} checked, ${trimmed} shortened (last id ${lastId})`);
}
console.log(`Done. Checked ${seen} entries, shortened ${trimmed}.`);
