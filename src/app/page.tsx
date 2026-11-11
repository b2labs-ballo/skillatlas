import Link from "next/link";
import { Suspense } from "react";
import { EntryCard } from "@/components/EntryCard";
import { Filters, type FilterState } from "@/components/Filters";
import { listEntries, PAGE_SIZE } from "@/lib/db";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

async function Directory({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const sp = await searchParams;
  const filters: FilterState = {
    q: one(sp.q).slice(0, 100),
    platform: one(sp.platform),
    type: one(sp.type),
    profession: one(sp.profession),
    task: one(sp.task),
    sort: one(sp.sort) === "newest" ? "newest" : "stars",
  };
  const page = Math.max(1, Number.parseInt(one(sp.page), 10) || 1);

  let entries: Awaited<ReturnType<typeof listEntries>>["entries"] = [];
  let total = 0;
  let failed = false;
  try {
    ({ entries, total } = await listEntries({ ...filters, page }));
  } catch {
    failed = true;
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(filters.q || filters.platform || filters.type || filters.profession || filters.task);
  const pageUrl = (n: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v && !(k === "sort" && v === "stars")) qs.set(k, v);
    if (n > 1) qs.set("page", String(n));
    const s = qs.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <>
      <Filters initial={filters} />

      <div className="flex items-center justify-between gap-3 text-sm text-muted" aria-live="polite">
        <p>
          {failed ? "" : `${total.toLocaleString("en")} ${total === 1 ? "result" : "results"}`}
          {!failed && pages > 1 ? ` · page ${Math.min(page, pages)} of ${pages.toLocaleString("en")}` : ""}
        </p>
        {hasFilters && (
          <Link href="/" className="font-medium text-accent hover:underline">
            Clear filters
          </Link>
        )}
      </div>

      {failed ? (
        <p className="rounded-2xl border border-line bg-surface p-6 text-center text-muted">
          The directory could not be loaded right now. Please try again in a moment.
        </p>
      ) : entries.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-6 text-center text-muted">
          Nothing matches yet. Try a shorter search or remove a filter.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((e) => (
            <li key={e.slug}>
              <EntryCard entry={e} />
            </li>
          ))}
        </ul>
      )}

      {!failed && pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-center gap-3 pt-2">
          {page > 1 ? (
            <Link href={pageUrl(page - 1)} className="h-11 rounded-full border border-line bg-surface px-5 text-sm font-medium leading-[2.6rem] hover:border-accent">
              ← Previous
            </Link>
          ) : (
            <span className="h-11 rounded-full border border-line px-5 text-sm font-medium leading-[2.6rem] text-muted opacity-50">← Previous</span>
          )}
          {page < pages ? (
            <Link href={pageUrl(page + 1)} className="h-11 rounded-full bg-accent px-5 text-sm font-medium leading-[2.75rem] text-on-accent hover:opacity-90">
              Next →
            </Link>
          ) : (
            <span className="h-11 rounded-full border border-line px-5 text-sm font-medium leading-[2.6rem] text-muted opacity-50">Next →</span>
          )}
        </nav>
      )}
    </>
  );
}

/** Grey placeholder shown for a moment while results load. */
function DirectorySkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading the directory">
      <div className="h-12 animate-pulse rounded-2xl bg-line/60" />
      <div className="h-10 w-2/3 animate-pulse rounded-full bg-line/60" />
      <div className="grid grid-cols-1 gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-44 animate-pulse rounded-2xl bg-line/60" />
        ))}
      </div>
    </div>
  );
}

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Find a skill for the job</h1>
        <p className="mt-1 text-sm text-muted sm:text-base">
          Community-made skills, plugins, MCP servers and custom GPTs for Claude and ChatGPT — each one credited and linked
          to its creator.
        </p>
      </div>
      <Suspense fallback={<DirectorySkeleton />}>
        <Directory searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
