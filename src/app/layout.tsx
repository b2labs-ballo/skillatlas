import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "SkillAtlas — skills, plugins and apps for Claude and ChatGPT", template: "%s · SkillAtlas" },
  description:
    "A directory of community-made skills, plugins, MCP servers and custom GPTs for Claude and ChatGPT. Find one for your job, then go straight to its creator.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0f13" },
  ],
};

// Runs before the page paints so there is no flash of the wrong theme.
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <svg viewBox="0 0 24 24" className="size-6 text-accent" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="9" />
                <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" fill="currentColor" stroke="none" />
              </svg>
              SkillAtlas
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/favorites" className="rounded-full px-3 py-2 font-medium text-muted hover:bg-accent-soft hover:text-ink">
                Favourites
              </Link>
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-muted">
            SkillAtlas is a directory. Every entry belongs to its creator — we link to and credit the original source and
            never copy or host anyone&apos;s code.
          </div>
        </footer>
      </body>
    </html>
  );
}
