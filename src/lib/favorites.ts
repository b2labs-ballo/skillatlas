"use client";
// Favourites are stored in the visitor's own browser (no account needed yet).

import { useSyncExternalStore } from "react";

const KEY = "skillatlas:favorites";
const EMPTY: string[] = [];
let cache: string[] | null = null;
const listeners = new Set<() => void>();

function read(): string[] {
  if (cache) return cache;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || "[]");
    cache = Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    cache = [];
  }
  return cache!;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      fn();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

export function toggleFavorite(slug: string) {
  const current = read();
  cache = current.includes(slug) ? current.filter((s) => s !== slug) : [slug, ...current];
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* private mode: keep it for this visit only */
  }
  listeners.forEach((fn) => fn());
}

export function useFavorites(): string[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
