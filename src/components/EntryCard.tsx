import Link from "next/link";
import { label } from "@/lib/categories";
import type { EntryCardData } from "@/lib/public-db";
import { formatDate, formatStars } from "@/lib/format";
import { FavoriteButton } from "./FavoriteButton";

export function EntryCard({ entry }: { entry: EntryCardData }) {
  const updated = formatDate(entry.last_updated);
  return (
    <article className="relative flex h-full flex-col rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-accent">
      <div className="flex items-start gap-3 pr-9">
        {entry.author_avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${entry.author_avatar}&s=80`} alt="" width={40} height={40} loading="lazy" className="size-10 shrink-0 rounded-lg bg-line" />
        ) : (
          <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-sm font-semibold text-accent" aria-hidden>
            {entry.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold leading-tight">
            {/* The stretched link makes the whole card clickable. */}
            <Link href={`/e/${entry.slug}`} className="after:absolute after:inset-0 after:rounded-2xl">
              {entry.name}
            </Link>
          </h2>
          <p className="truncate text-sm text-muted">by {entry.author}</p>
        </div>
      </div>

      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted">
        {entry.description || "No description provided by the author."}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-medium">
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">{label(entry.type)}</span>
        {entry.platforms.map((p) => (
          <span key={p} className="rounded-full border border-line px-2 py-0.5 text-muted">
            {label(p)}
          </span>
        ))}
        {entry.professions.slice(0, 1).map((p) => (
          <span key={p} className="rounded-full border border-line px-2 py-0.5 text-muted">
            {label(p)}
          </span>
        ))}
      </div>

      <div className="mt-auto flex items-center gap-3 pt-3 text-xs text-muted">
        {entry.type !== "gpt" && (
          <span className="flex items-center gap-1" title={`${entry.stars} GitHub stars`}>
            <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor" aria-hidden>
              <path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9 2.9-6Z" />
            </svg>
            {formatStars(entry.stars)}
          </span>
        )}
        {updated && <span>Updated {updated}</span>}
      </div>

      <FavoriteButton slug={entry.slug} name={entry.name} className="absolute right-2 top-2 z-10" />
    </article>
  );
}
