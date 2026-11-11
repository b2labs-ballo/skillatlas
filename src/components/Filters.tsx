"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { type Option, PLATFORMS, PROFESSIONS, SORTS, TASKS, TYPES } from "@/lib/categories";

export type FilterState = { q: string; platform: string; type: string; profession: string; task: string; sort: string };

function toUrl(state: FilterState) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(state)) {
    if (v && !(k === "sort" && v === "stars")) qs.set(k, v);
  }
  const s = qs.toString();
  return s ? `/?${s}` : "/";
}

function Chips({ name, options, value, onPick }: { name: string; options: Option[]; value: string; onPick: (v: string) => void }) {
  return (
    <div role="group" aria-label={name} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
      {[{ slug: "", label: `All ${name.toLowerCase()}s` }, ...options].map((o) => {
        const active = value === o.slug;
        return (
          <button
            key={o.slug}
            type="button"
            aria-pressed={active}
            onClick={() => onPick(o.slug)}
            className={`h-10 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors ${
              active ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-muted hover:border-accent hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Select({ id, text, options, value, all, onPick }: { id: string; text: string; options: Option[]; value: string; all?: string; onPick: (v: string) => void }) {
  return (
    <label htmlFor={id} className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-muted">
      {text}
      <select
        id={id}
        value={value}
        onChange={(e) => onPick(e.target.value)}
        className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink"
      >
        {all && <option value="">{all}</option>}
        {options.map((o) => (
          <option key={o.slug} value={o.slug}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Filters({ initial }: { initial: FilterState }) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep in sync when the address changes some other way (back button, "Clear filters" link).
  const initialKey = JSON.stringify(initial);
  const [lastKey, setLastKey] = useState(initialKey);
  if (initialKey !== lastKey) {
    setLastKey(initialKey);
    setState(initial);
  }
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const go = (next: FilterState, delay = 0) => {
    setState(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => startTransition(() => router.replace(toUrl(next), { scroll: false })), delay);
  };

  return (
    <section aria-label="Search and filters" className="flex flex-col gap-3">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          go(state);
        }}
        className="relative"
      >
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          type="search"
          name="q"
          value={state.q}
          onChange={(e) => go({ ...state, q: e.target.value }, 350)}
          placeholder="Search skills, plugins, MCP servers, GPTs…"
          aria-label="Search the directory"
          autoComplete="off"
          enterKeyHint="search"
          className="h-12 w-full rounded-2xl border border-line bg-surface pl-12 pr-10 text-base text-ink placeholder:text-muted"
        />
        {pending && (
          <span role="status" aria-label="Loading results" className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-line border-t-accent" />
        )}
      </form>

      <Chips name="Platform" options={PLATFORMS} value={state.platform} onPick={(v) => go({ ...state, platform: v })} />
      <Chips name="Type" options={TYPES} value={state.type} onPick={(v) => go({ ...state, type: v })} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Select id="profession" text="Profession" options={PROFESSIONS} value={state.profession} all="Any profession" onPick={(v) => go({ ...state, profession: v })} />
        <Select id="task" text="Task" options={TASKS} value={state.task} all="Any task" onPick={(v) => go({ ...state, task: v })} />
        <div className="col-span-2 sm:col-span-1">
          <Select id="sort" text="Sort by" options={SORTS} value={state.sort} onPick={(v) => go({ ...state, sort: v })} />
        </div>
      </div>
    </section>
  );
}
