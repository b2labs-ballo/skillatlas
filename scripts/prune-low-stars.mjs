// Removes entries with too few GitHub stars from the directory, in small
// batches so the database is not overloaded. Uses the same minimums as the ingest:
//   MCP servers: MCP_MIN_STARS (default 10)
//   skills, plugins, collections: MIN_STARS (default 1)
// Run:  node scripts/prune-low-stars.mjs

import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const URL_ = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!URL_ || !KEY) {
  console.error("Missing database keys in .env.local");
  process.exit(1);
}
const RULES = [
  ["mcp", Number(process.env.MCP_MIN_STARS || 10)],
  ["skill", Number(process.env.MIN_STARS || 1)],
  ["plugin", Number(process.env.MIN_STARS || 1)],
  ["collection", Number(process.env.MIN_STARS || 1)],
];
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const [type, min] of RULES) {
  // Only entries that live on GitHub have stars; curated lists themselves are kept by their own stars too.
  const filter = `type=eq.${type}&stars=lt.${min}&source=eq.github`;
  let removed = 0;
  let failures = 0;
  for (;;) {
    try {
      const res = await fetch(`${URL_}/rest/v1/entries?select=id&${filter}&order=id&limit=200`, { headers });
      if (!res.ok) throw new Error(`Database error ${res.status}: ${(await res.text()).slice(0, 150)}`);
      const ids = (await res.json()).map((r) => r.id);
      if (ids.length === 0) break;
      const del = await fetch(`${URL_}/rest/v1/entries?${filter}&id=in.(${ids.join(",")})`, { method: "DELETE", headers: { ...headers, Prefer: "return=minimal" } });
      if (!del.ok) throw new Error(`Database error ${del.status}: ${(await del.text()).slice(0, 150)}`);
      removed += ids.length;
      failures = 0;
      if (removed % 4000 === 0) console.log(`  …${removed} ${type} entries removed`);
      await sleep(300);
    } catch (err) {
      if (++failures > 6) throw err;
      console.log(`  ${err.message} — trying again in ${failures * 20}s…`);
      await sleep(failures * 20000);
    }
  }
  console.log(`${type}: removed ${removed} with fewer than ${min} star(s).`);
}
