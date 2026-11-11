import Link from "next/link";
import { label } from "@/lib/categories";
import { formatStars } from "@/lib/format";
import type { EntryCardData } from "@/lib/public-db";
import { typeStyle } from "@/lib/typeStyle";
import { FavoriteButton } from "./FavoriteButton";

export function Avatar({ entry, size }: { entry: Pick<EntryCardData, "author_avatar" | "name" | "type">; size: number }) {
  const style = { width: size, height: size };
  return entry.author_avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={entry.author_avatar.includes("avatars.githubusercontent.com") ? `${entry.author_avatar}&s=${size * 2}` : entry.author_avatar} alt="" width={size} height={size} loading="lazy" style={style} className="shrink-0 rounded-2xl bg-line object-cover" />
  ) : (
    <div style={style} className={`grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-lg font-bold text-white ${typeStyle(entry.type).tile}`} aria-hidden>
      {entry.name.charAt(0).toUpperCase()}
    </div>
  );
}

export function TypeBadge({ type }: { type: string }) {
  const s = typeStyle(type);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${s.badge}`}>
      <span className={`size-1.5 rounded-full ${s.dot}`} aria-hidden />
      {label(type)}
    </span>
  );
}

export function EntryCard({ entry }: { entry: EntryCardData }) {
  return (
    <article className="relative flex h-full flex-col gap-4 rounded-3xl border border-line bg-surface p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-accent hover:shadow-card-hover">
      <div className="flex items-center gap-3.5 pr-9">
        <Avatar entry={entry} size={48} />
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold leading-snug">
            {/* The stretched link makes the whole card clickable. */}
            <Link href={`/e/${entry.slug}`} className="after:absolute after:inset-0 after:rounded-3xl">
              {entry.name}
            </Link>
          </h2>
          <p className="truncate text-sm text-muted">by {entry.author}</p>
        </div>
      </div>

      <p className="line-clamp-2 text-[15px] leading-relaxed text-muted">
        {entry.description || "No description provided by the author."}
      </p>

      <div className="mt-auto flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <TypeBadge type={entry.type} />
          <span className="truncate text-xs font-medium text-muted">{entry.platforms.map(label).join(" · ")}</span>
        </div>
        {entry.stars > 0 && (
          <span className="flex shrink-0 items-center gap-1 text-sm font-semibold" title={`${entry.stars} ${entry.type === "model" ? "likes" : "stars"}`}>
            <svg viewBox="0 0 24 24" className="size-4 text-amber-400" fill="currentColor" aria-hidden>
              <path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9 2.9-6Z" />
            </svg>
            {formatStars(entry.stars)}
          </span>
        )}
      </div>

      <FavoriteButton slug={entry.slug} name={entry.name} className="absolute right-3 top-3 z-10" />
    </article>
  );
}
