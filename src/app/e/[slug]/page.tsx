import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CopyButton } from "@/components/CopyButton";
import { Avatar, EntryCard, TypeBadge } from "@/components/EntryCard";
import { FavoriteButton } from "@/components/FavoriteButton";
import { Readme } from "@/components/Readme";
import { fullLabel, label } from "@/lib/categories";
import { type Entry, getEntry, getReadme, getRelated } from "@/lib/db";
import { formatDate, formatStars } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/e/[slug]">): Promise<Metadata> {
  const entry = await getEntry((await params).slug).catch(() => null);
  if (!entry) return { title: "Not found" };
  return { title: `${entry.name} by ${entry.author}`, description: entry.description ?? undefined };
}

const external = { target: "_blank", rel: "noopener noreferrer nofollow" } as const;
const card = "rounded-2xl bg-surface p-5 sm:p-8";
const button = "inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold";
const secondary = `${button} bg-chip hover:bg-chip-hover`;

const WHAT_IT_IS: Record<string, string> = {
  skill: "A skill is a set of instructions and files that teaches the AI how to do one kind of task well.",
  plugin: "A plugin adds new commands, skills or tools to Claude Code in one install.",
  collection: "A collection gathers many skills or plugins in one place, so you can browse and pick what you need.",
  mcp: "An MCP server (app / connector) lets the AI work with another tool or service on your behalf.",
  gpt: "A custom GPT is a ready-made version of ChatGPT set up for one particular job.",
  subagent: "Subagents, commands and hooks are small add-ons that give Claude Code a specialist helper or a shortcut.",
  prompt: "Prompts and rules are ready-made instructions you paste in or save as a file so the AI behaves the way you want.",
  agent: "A coding agent is an AI assistant that reads, writes and runs code for you, usually from the terminal or your editor.",
  "local-app": "A local app lets you run or use AI on your own computer, often without sending data to the cloud.",
  extension: "An editor extension adds AI help directly inside your code editor.",
  model: "A local model is an AI model you download and run on your own computer with an app such as Ollama or LM Studio.",
};

const SOURCE_NAME: Record<string, string> = { openvsx: "Open VSX", huggingface: "Hugging Face" };

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function Fact({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-chip px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{name}</dt>
      <dd className="mt-0.5 truncate text-base font-bold">{children}</dd>
    </div>
  );
}

function Chips({ title, items, param }: { title: string; items: string[]; param: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((s) => (
          <Link key={s} href={`/?${param}=${s}`} className="rounded-lg bg-chip px-3.5 py-1.5 text-sm font-medium hover:bg-chip-hover">
            {label(s)}
          </Link>
        ))}
      </div>
    </div>
  );
}

async function CreatorReadme({ entry }: { entry: Entry }) {
  const { text, complete } = await getReadme(entry);
  if (!text?.trim()) {
    return <p className="text-muted">The creator has not published a longer description. Open the original page for details.</p>;
  }
  return (
    <>
      <Readme markdown={text} githubUrl={entry.github_url} branch={entry.default_branch} sourceUrl={entry.source_url} />
      {!complete && entry.github_url && (
        <p className="mt-6 rounded-2xl bg-accent-soft px-4 py-3 text-sm font-medium">
          This description is shortened here.{" "}
          <a href={`${entry.github_url}#readme`} {...external} className="font-semibold text-accent hover:underline">
            Read the rest on GitHub →
          </a>
        </p>
      )}
    </>
  );
}

async function Related({ entry }: { entry: Entry }) {
  const related = await getRelated(entry).catch(() => []);
  if (related.length === 0) return null;
  return (
    <section aria-labelledby="related">
      <h2 id="related" className="text-2xl font-extrabold tracking-tight">
        More like this
      </h2>
      <ul className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {related.map((e) => (
          <li key={e.slug}>
            <EntryCard entry={e} />
          </li>
        ))}
      </ul>
    </section>
  );
}

async function EntryDetail({ params }: Pick<PageProps<"/e/[slug]">, "params">) {
  const entry = await getEntry((await params).slug);
  if (!entry) notFound();
  const updated = formatDate(entry.last_updated);
  const isGpt = entry.type === "gpt";
  const sourceName = SOURCE_NAME[entry.source ?? ""];
  const original = !entry.github_url && sourceName ? entry.source_url : null; // non-GitHub entries link to their own page
  const sourceList = entry.found_via.find((v) => v.startsWith("list:") && v !== "list:self")?.slice(5);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Link href="/" className="self-start text-sm font-semibold text-accent hover:underline">
        ← Back to the directory
      </Link>

      {/* Summary: what it is, who made it, where to get it */}
      <header className={card}>
        <div className="flex items-start gap-4">
          <Avatar entry={entry} size={64} />
          <div className="min-w-0 flex-1">
            <h1 className="break-words text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">{entry.name}</h1>
            <p className="mt-1 text-base text-muted">
              by{" "}
              {entry.author_url ? (
                <a href={entry.author_url} {...external} className="font-semibold text-accent hover:underline">
                  {entry.author}
                </a>
              ) : (
                <span className="font-semibold text-ink">{entry.author}</span>
              )}
            </p>
          </div>
          <FavoriteButton slug={entry.slug} name={entry.name} className="bg-chip" />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <TypeBadge type={entry.type} />
          {entry.platforms.length > 0 && <span className="text-sm font-semibold text-muted">Works with {entry.platforms.map(fullLabel).join(", ")}</span>}
        </div>

        <p className="mt-5 text-lg leading-relaxed">{entry.description || "No short description provided by the author."}</p>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{WHAT_IT_IS[entry.type]}</p>

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {entry.github_url && <Fact name="GitHub stars">★ {formatStars(entry.stars)}</Fact>}
          {entry.type === "model" && <Fact name="Likes">♥ {formatStars(entry.stars)}</Fact>}
          {entry.downloads ? <Fact name={entry.github_url ? "Monthly installs" : "Downloads"}>{formatStars(entry.downloads)}</Fact> : null}
          {updated && <Fact name="Last updated">{updated}</Fact>}
          {!isGpt && <Fact name="License">{entry.license ?? "Not stated"}</Fact>}
          <Fact name="Made by">{entry.author}</Fact>
        </dl>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {entry.github_url && (
            <a href={entry.github_url} {...external} className={`${button} btn-primary`}>
              <Icon d="M14 5h5v5M19 5l-8 8M11 7H6v11h11v-5" />
              Open on GitHub
            </a>
          )}
          {entry.github_url && (
            <a href={`${entry.github_url}/archive/HEAD.zip`} rel="noopener noreferrer nofollow" className={secondary} title="Downloads the latest version as a ZIP file, straight from the creator's GitHub repository">
              <Icon d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M5 19h14" />
              Download ZIP
            </a>
          )}
          {original && (
            <a href={original} {...external} className={`${button} btn-primary`}>
              <Icon d="M14 5h5v5M19 5l-8 8M11 7H6v11h11v-5" />
              Open on {sourceName}
            </a>
          )}
          {entry.homepage_url && (
            <a href={entry.homepage_url} {...external} className={entry.github_url || original ? secondary : `${button} btn-primary shadow-card`}>
              <Icon d={isGpt ? "M14 5h5v5M19 5l-8 8M11 7H6v11h11v-5" : "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.400 12 21c-2.5-2.600-3.800-5.600-3.800-9S9.500 5.600 12 3Z"} />
              {isGpt ? "Open in ChatGPT" : "Creator's site"}
            </a>
          )}
        </div>
        {entry.github_url && (
          <p className="mt-3 text-sm text-muted">
            The download comes straight from {entry.author}&apos;s GitHub repository — SkillAtlas hosts no files. Review anything you
            download before running it.
          </p>
        )}
      </header>

      {/* Install */}
      {entry.install_command && (
        <section aria-labelledby="install" className={card}>
          <h2 id="install" className="text-2xl font-extrabold tracking-tight">
            How to install
          </h2>
          <p className="mt-2 text-[15px] text-muted">Copy this command to install. Full setup and usage instructions are in the creator&apos;s description below.</p>
          <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-black p-3 pl-5">
            <code className="no-scrollbar min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-sm text-[#f1f1f1]">{entry.install_command}</code>
            <CopyButton text={entry.install_command} />
          </div>
        </section>
      )}

      {/* Categories */}
      {(entry.professions.length > 0 || entry.tasks.length > 0) && (
        <section aria-label="Categories" className={`${card} flex flex-col gap-5 sm:flex-row sm:gap-12`}>
          <Chips title="Good for" items={entry.professions} param="profession" />
          <Chips title="Helps with" items={entry.tasks} param="task" />
        </section>
      )}

      {/* The creator's own description */}
      {!isGpt && (
        <section aria-labelledby="readme" className={card}>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-5">
            <div>
              <h2 id="readme" className="text-2xl font-extrabold tracking-tight">
                Full description from the creator
              </h2>
              <p className="mt-1 text-sm text-muted">
                Written by {entry.author}. Shown here unchanged, with credit — all rights stay with the author.
              </p>
            </div>
            {(entry.github_url || original) && (
              <a href={entry.github_url ? `${entry.github_url}#readme` : original!} {...external} className="text-sm font-semibold text-accent hover:underline">
                View original →
              </a>
            )}
          </div>
          <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-line/60" role="status" aria-label="Loading description" />}>
            <CreatorReadme entry={entry} />
          </Suspense>
        </section>
      )}

      {sourceList && (
        <p className="text-sm text-muted">
          Found via the list{" "}
          <a href={`https://github.com/${sourceList}`} {...external} className="font-semibold text-accent hover:underline">
            {sourceList}
          </a>
          .
        </p>
      )}

      <Suspense fallback={null}>
        <Related entry={entry} />
      </Suspense>
    </div>
  );
}

export default function EntryPage({ params }: PageProps<"/e/[slug]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-line/60" role="status" aria-label="Loading" />}>
      <EntryDetail params={params} />
    </Suspense>
  );
}
