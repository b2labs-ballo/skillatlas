// Calls one of the small database functions from the browser (counters and the
// feedback form). Uses only the public key; the functions accept nothing else.

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./public-db";

export async function callFunction(name: string, body: Record<string, unknown> = {}): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true, // still sent when the click leaves the page
    });
    return res.ok;
  } catch {
    return false;
  }
}
