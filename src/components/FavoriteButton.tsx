"use client";

import { toggleFavorite, useFavorites } from "@/lib/favorites";

export function FavoriteButton({ slug, name, className = "" }: { slug: string; name: string; className?: string }) {
  const saved = useFavorites().includes(slug);
  return (
    <button
      type="button"
      onClick={() => toggleFavorite(slug)}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${name} from favourites` : `Save ${name} to favourites`}
      title={saved ? "Remove from favourites" : "Save to favourites"}
      className={`grid size-10 place-items-center rounded-full hover:bg-accent-soft ${saved ? "text-rose-500" : "text-muted hover:text-ink"} ${className}`}
    >
      <svg viewBox="0 0 24 24" className="size-5" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
        <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z" />
      </svg>
    </button>
  );
}
