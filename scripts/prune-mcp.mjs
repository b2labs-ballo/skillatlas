// Removes MCP servers with fewer stars than the minimum from the directory,
// in small batches so the database is not overloaded.
// Run:  node scripts/prune-mcp.mjs        (uses MCP_MIN_STARS, default 10)

import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const URL_ = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const MIN = Number(process.env.MCP_MIN_STARS || 10);
if (!URL_ || !KEY) {
  console.error("Missing database keys in .env.local");
  process.exit(1);
}
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let removed = 0;
let failures = 0;
for (;;) {
  try {
    const res = await fetch(`${URL_}/rest/v1/entries?select=id&type=eq.mcp&stars=lt.${MIN}&order=id&limit=200`, { headers });
    if (!res.ok) throw new Error(`Database error ${res.status}: ${(await res.text()).slice(0, 150)}`);
    const ids = (await res.json()).map((r) => r.id);
    if (ids.length === 0) break;
    const del = await fetch(`${URL_}/rest/v1/entries?type=eq.mcp&stars=lt.${MIN}&id=in.(${ids.join(",")})`, {
      method: "DELETE",
      headers: { ...headers, Prefer: "return=minimal" },
    });
    if (!del.ok) throw new Error(`Database error ${del.status}: ${(await del.text()).slice(0, 150)}`);
    removed += ids.length;
    failures = 0;
    if (removed % 2000 === 0) console.log(`…${removed} removed`);
    await sleep(300);
  } catch (err) {
    if (++failures > 6) throw err;
    console.log(`  ${err.message} — trying again in ${failures * 20}s…`);
    await sleep(failures * 20000);
  }
}
console.log(`Done. Removed ${removed} MCP servers with fewer than ${MIN} stars.`);
