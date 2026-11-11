// Each entry type has its own colour so the list is easy to scan.

type Style = { badge: string; dot: string; tile: string };

const STYLES: Record<string, Style> = {
  skill: {
    badge: "bg-violet-100 text-violet-800 dark:bg-violet-400/20 dark:text-violet-200",
    dot: "bg-violet-500",
    tile: "from-violet-500 to-fuchsia-500",
  },
  plugin: {
    badge: "bg-orange-100 text-orange-800 dark:bg-orange-400/20 dark:text-orange-200",
    dot: "bg-orange-500",
    tile: "from-orange-500 to-rose-500",
  },
  collection: {
    badge: "bg-teal-100 text-teal-800 dark:bg-teal-400/20 dark:text-teal-200",
    dot: "bg-teal-500",
    tile: "from-teal-500 to-emerald-500",
  },
  mcp: {
    badge: "bg-sky-100 text-sky-800 dark:bg-sky-400/20 dark:text-sky-200",
    dot: "bg-sky-500",
    tile: "from-sky-500 to-indigo-500",
  },
  gpt: {
    badge: "bg-pink-100 text-pink-800 dark:bg-pink-400/20 dark:text-pink-200",
    dot: "bg-pink-500",
    tile: "from-pink-500 to-amber-500",
  },
  subagent: {
    badge: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-400/20 dark:text-fuchsia-200",
    dot: "bg-fuchsia-500",
    tile: "from-fuchsia-500 to-violet-500",
  },
  prompt: {
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200",
    dot: "bg-amber-500",
    tile: "from-amber-500 to-orange-500",
  },
  agent: {
    badge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-400/20 dark:text-indigo-200",
    dot: "bg-indigo-500",
    tile: "from-indigo-500 to-violet-500",
  },
  "local-app": {
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-200",
    dot: "bg-emerald-500",
    tile: "from-emerald-500 to-teal-500",
  },
  extension: {
    badge: "bg-cyan-100 text-cyan-800 dark:bg-cyan-400/20 dark:text-cyan-200",
    dot: "bg-cyan-500",
    tile: "from-cyan-500 to-sky-500",
  },
  model: {
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-400/20 dark:text-rose-200",
    dot: "bg-rose-500",
    tile: "from-rose-500 to-orange-400",
  },
};

export const typeStyle = (type: string): Style => STYLES[type] ?? STYLES.skill;
