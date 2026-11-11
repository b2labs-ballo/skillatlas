import type { Metadata, Viewport } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "SkillAtlas — skills, plugins and apps for Claude and ChatGPT", template: "%s · SkillAtlas" },
  description:
    "A directory of community-made skills, plugins, MCP servers and custom GPTs for Claude and ChatGPT. Find one for your job, then go straight to its creator.",
};

export const viewport: Viewport = {
  themeColor: [
    { color: "#fbf8ff" },
  ],
};

// Runs before the page paints so there is no flash of the wrong theme.
// The site is light unless the visitor has switched to dark themselves.
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t==="dark")document.documentElement.classList.add("dark")}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <header className="sticky top-0 z-20 border-b border-line/70 bg-bg/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
            <Link href="/" className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight">
              <span className="btn-primary grid size-9 place-items-center rounded-xl" aria-hidden>
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" fill="currentColor" stroke="none" />
                </svg>
              </span>
              SkillAtlas
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/favorites" className="rounded-full px-4 py-2 font-semibold text-muted hover:bg-accent-soft hover:text-accent">
                Favourites
              </Link>
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:py-12">{children}</main>
        <footer className="mt-8 border-t border-line">
          <div className="mx-auto w-full max-w-6xl px-5 py-8 text-sm leading-relaxed text-muted">
            SkillAtlas is a directory. Every entry belongs to its creator — we link to and credit the original source and
            never copy or host anyone&apos;s code.
          </div>
        </footer>
      </body>
    </html>
  );
}
