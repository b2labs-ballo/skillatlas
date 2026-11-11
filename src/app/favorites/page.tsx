"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EntryCard } from "@/components/EntryCard";
import { CARD_COLUMNS, type EntryCardData, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/public-db";
import { useFavorites } from "@/lib/favorites";

export default function FavoritesPage() {
  const slugs = useFavorites();
  const [loaded, setLoaded] = useState<{ key: string; entries: EntryCardData[]; failed: boolean } | null>(null);
  const key = slugs.join(",");

  useEffect(() => {
    if (slugs.length === 0) return;
    let cancelled = false;
    const list = slugs.slice(0, 200).map((s) => `"${s.replace(/[^a-z0-9-]/g, "")}"`).join(",");
    const qs = new URLSearchParams({ select: CARD_COLUMNS, slug: `in.(${list})` });
    fetch(`${SUPABASE_URL}/rest/v1/entries?${qs}`, { headers: { apikey: SUPABASE_ANON_KEY } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((rows: EntryCardData[]) => {
        if (!cancelled) setLoaded({ key, entries: rows, failed: false });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key, entries: [], failed: true });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Show in the order they were saved (newest first); hide ones just removed.
  const bySlug = new Map((loaded?.entries ?? []).map((e) => [e.slug, e]));
  const entries = slugs.map((s) => bySlug.get(s)).filter((e): e is EntryCardData => Boolean(e));
  const loading = slugs.length > 0 && !loaded;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Your <span className="text-gradient">favourites</span>
        </h1>
        <p className="mt-3 text-base text-muted">Saved in this browser on this device.</p>
      </div>

      {slugs.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-6 text-center text-muted">
          Nothing saved yet. Tap the heart on any entry to keep it here.{" "}
          <Link href="/" className="font-medium text-accent hover:underline">
            Browse the directory
          </Link>
        </p>
      ) : loading ? (
        <p className="text-sm text-muted" role="status">
          Loading your favourites…
        </p>
      ) : loaded?.failed ? (
        <p className="rounded-2xl border border-line bg-surface p-6 text-center text-muted">
          Your favourites could not be loaded right now. Please try again in a moment.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {entries.map((e) => (
            <li key={e.slug}>
              <EntryCard entry={e} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
