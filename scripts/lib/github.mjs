// Small GitHub API client that respects rate limits.
// - Waits when GitHub says the limit is used up (instead of hammering it).
// - Spaces out search requests (search has its own, much lower limits).

const API = "https://api.github.com";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class RateLimitError extends Error {}

export function createGitHub({ token, log = console.log }) {
  const authed = Boolean(token);
  // Minimum gap between requests per bucket (milliseconds).
  const gaps = {
    core: authed ? 0 : 200,
    search: authed ? 2200 : 6500, // 30/min with token, 10/min without
    code: 6500, // code search: 10/min
  };
  const nextAt = { core: 0, search: 0, code: 0 };
  let calls = 0;

  async function throttle(bucket) {
    const now = Date.now();
    const at = Math.max(now, nextAt[bucket]);
    nextAt[bucket] = at + gaps[bucket];
    if (at > now) await sleep(at - now);
  }

  /**
   * GET a GitHub API path. Returns parsed JSON (or text when raw=true),
   * or null when the thing does not exist / is not accessible.
   */
  async function get(path, { bucket = "core", raw = false } = {}) {
    const url = path.startsWith("http") ? path : API + path;
    for (let attempt = 0; attempt < 6; attempt++) {
      await throttle(bucket);
      calls++;
      let res;
      try {
        res = await fetch(url, {
          headers: {
            Accept: raw ? "application/vnd.github.raw+json" : "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "skillatlas-ingest",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
      } catch (err) {
        log(`  network error (${err.message}), retrying…`);
        await sleep(3000 * (attempt + 1));
        continue;
      }

      if (res.status === 403 || res.status === 429) {
        const remaining = res.headers.get("x-ratelimit-remaining");
        const reset = Number(res.headers.get("x-ratelimit-reset") || 0) * 1000;
        const retryAfter = Number(res.headers.get("retry-after") || 0) * 1000;
        const isLimit = remaining === "0" || retryAfter > 0 || res.status === 429;
        if (!isLimit) return null; // forbidden for another reason (blocked repo etc.)
        const wait = retryAfter || (reset ? Math.max(reset - Date.now(), 0) + 2000 : 60000);
        if (!authed && wait > 90_000) {
          throw new RateLimitError("GitHub rate limit reached (no token). Add GITHUB_TOKEN to continue.");
        }
        log(`  rate limit reached, waiting ${Math.ceil(wait / 1000)}s…`);
        await sleep(wait);
        continue;
      }
      if (res.status === 404 || res.status === 451 || res.status === 409) return null;
      if (res.status === 422 || res.status === 401) {
        log(`  GitHub refused request (${res.status}) for ${path}`);
        return null;
      }
      if (res.status >= 500) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      if (!res.ok) return null;
      return raw ? res.text() : res.json();
    }
    return null;
  }

  return { get, authed, calls: () => calls };
}

/** Run async work over a list with a small number of parallel workers. */
export async function pool(items, size, worker) {
  let i = 0;
  const runners = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
}
