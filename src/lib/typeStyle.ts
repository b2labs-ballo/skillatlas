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
};

export const typeStyle = (type: string): Style => STYLES[type] ?? STYLES.skill;
