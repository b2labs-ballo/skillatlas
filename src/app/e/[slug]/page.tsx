// Basic detail page. The full version (rendered README, install box, related
// entries) is built in the next stage.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FavoriteButton } from "@/components/FavoriteButton";
import { label } from "@/lib/categories";
import { getEntry } from "@/lib/db";
import { formatDate, formatStars } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/e/[slug]">): Promise<Metadata> {
  const entry = await getEntry((await params).slug).catch(() => null);
  if (!entry) return { title: "Not found" };
  return { title: `${entry.name} by ${entry.author}`, description: entry.description ?? undefined };
}

async function EntryDetail({ params }: Pick<PageProps<"/e/[slug]">, "params">) {
  const entry = await getEntry((await params).slug);
  if (!entry) notFound();
  const updated = formatDate(entry.last_updated);
  const button = "inline-flex h-11 items-center rounded-full px-5 text-sm font-medium";

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-5">
      <Link href="/" className="text-sm font-medium text-accent hover:underline">
        ← Back to the directory
      </Link>
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">{entry.name}</h1>
          <p className="mt-1 text-muted">
            by{" "}
            {entry.author_url ? (
              <a href={entry.author_url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-ink underline decoration-line underline-offset-4 hover:decoration-accent">
                {entry.author}
              </a>
            ) : (
              <span className="font-medium text-ink">{entry.author}</span>
            )}
          </p>
        </div>
        <FavoriteButton slug={entry.slug} name={entry.name} />
      </header>

      <p className="text-base leading-relaxed">{entry.description || "No description provided by the author."}</p>

      <div className="flex flex-wrap gap-1.5 text-xs font-medium">
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">{label(entry.type)}</span>
        {[...entry.platforms, ...entry.professions, ...entry.tasks].map((s) => (
          <span key={s} className="rounded-full border border-line px-2 py-0.5 text-muted">
            {label(s)}
          </span>
        ))}
      </div>

      <p className="text-sm text-muted">
        {[entry.type !== "gpt" ? `${formatStars(entry.stars)} stars` : null, updated ? `Updated ${updated}` : null, entry.license ? `License: ${entry.license}` : null]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <div className="flex flex-wrap gap-3">
        {entry.github_url && (
          <a href={entry.github_url} target="_blank" rel="noopener noreferrer nofollow" className={`${button} bg-accent text-on-accent hover:opacity-90`}>
            Open on GitHub
          </a>
        )}
        {entry.homepage_url && (
          <a
            href={entry.homepage_url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={`${button} ${entry.github_url ? "border border-line bg-surface hover:border-accent" : "bg-accent text-on-accent hover:opacity-90"}`}
          >
            {entry.type === "gpt" ? "Open in ChatGPT" : "Creator's site"}
          </a>
        )}
      </div>
    </article>
  );
}

export default function EntryPage({ params }: PageProps<"/e/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-64 max-w-3xl animate-pulse rounded-2xl bg-line/60" role="status" aria-label="Loading" />}>
      <EntryDetail params={params} />
    </Suspense>
  );
}
