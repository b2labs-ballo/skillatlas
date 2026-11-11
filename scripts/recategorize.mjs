// Re-assigns profession and task categories for every entry already in the
// database, using the current rules in src/lib/categories.json.
// Run after changing the category list:  node scripts/recategorize.mjs

import { existsSync } from "node:fs";
import { categorize } from "./lib/classify.mjs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const URL_ = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!URL_ || !KEY) {
  console.error("Missing database keys in .env.local");
  process.exit(1);
}
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

let lastId = 0;
let seen = 0;
let changed = 0;
const counts = {};
for (;;) {
  const res = await fetch(`${URL_}/rest/v1/entries?select=id,source_key,slug,name,author,type,description,topics,readme,professions,tasks&id=gt.${lastId}&order=id&limit=300`, { headers });
  if (!res.ok) throw new Error(`Database error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const rows = await res.json();
  if (rows.length === 0) break;
  lastId = rows[rows.length - 1].id;
  seen += rows.length;

  const updates = [];
  for (const r of rows) {
    const next = categorize(r);
    for (const p of next.professions) counts[p] = (counts[p] || 0) + 1;
    if (same(next.professions, r.professions) && same(next.tasks, r.tasks)) continue;
    // slug, name, author and type are included only because the database requires them on every write.
    updates.push({ source_key: r.source_key, slug: r.slug, name: r.name, author: r.author, type: r.type, ...next });
  }
  if (updates.length) {
    const up = await fetch(`${URL_}/rest/v1/entries?on_conflict=source_key`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(updates),
    });
    if (!up.ok) throw new Error(`Database error ${up.status}: ${(await up.text()).slice(0, 200)}`);
    changed += updates.length;
  }
  if (seen % 3000 === 0) console.log(`  …${seen} checked, ${changed} updated`);
}
console.log(`Checked ${seen} entries, updated ${changed}.`);
console.log(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join("\n"));
