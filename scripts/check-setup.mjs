// Checks that the keys in .env.local work. Never prints the keys themselves.
import { existsSync } from "node:fs";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const env = process.env;
const url = (env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "").trim().replace(/\/+$/, "");
const show = (name) => {
  const v = (env[name] || "").trim();
  console.log(`${name.padEnd(32)} ${v ? `filled in (${v.length} characters, starts "${v.slice(0, 4)}…")` : "MISSING"}`);
  return v;
};

const token = show("GITHUB_TOKEN");
console.log(`${"NEXT_PUBLIC_SUPABASE_URL".padEnd(32)} ${url || "MISSING"}`);
const anon = show("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const service = show("SUPABASE_SERVICE_ROLE_KEY");
console.log("");

if (token) {
  const r = await fetch("https://api.github.com/rate_limit", { headers: { Authorization: `Bearer ${token}`, "User-Agent": "skillatlas-ingest" } });
  const j = await r.json().catch(() => ({}));
  console.log(r.ok ? `GitHub token: OK (limit ${j.resources?.core?.limit}/hour, search ${j.resources?.search?.limit}/min, code search ${j.resources?.code_search?.limit}/min)` : `GitHub token: NOT accepted (${r.status})`);
}

async function table(label, key) {
  if (!url || !key) return console.log(`${label}: skipped (missing URL or key)`);
  try {
    const r = await fetch(`${url}/rest/v1/entries?select=id&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" } });
    const body = await r.text();
    console.log(r.ok ? `${label}: OK, table "entries" found (${r.headers.get("content-range")?.split("/")[1] ?? "?"} rows)` : `${label}: ERROR ${r.status} ${body.slice(0, 200)}`);
  } catch (err) {
    console.log(`${label}: cannot reach ${url} (${err.cause?.code || err.message})`);
  }
}
await table("Supabase public key", anon);
await table("Supabase secret key", service);
