import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist_Mono, Inter } from "next/font/google";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import "./globals.css";

const body = Inter({ variable: "--font-body", subsets: ["latin"] });
const heading = Bricolage_Grotesque({ variable: "--font-heading", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "SkillAtlas — skills, plugins and apps for Claude and ChatGPT", template: "%s · SkillAtlas" },
  description:
    "A directory of community-made skills, plugins, MCP servers and custom GPTs for Claude and ChatGPT. Find one for your job, then go straight to its creator.",
};

export const viewport: Viewport = {
  themeColor: [
    { color: "#0f0f0f" },
  ],
};

// Runs before the page paints so there is no flash of the wrong theme.
// The site is dark unless the visitor has switched to light themselves.
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t==="light")document.documentElement.classList.remove("dark")}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`dark ${body.variable} ${heading.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <header className="sticky top-0 z-20 bg-bg/90 backdrop-blur-md">
          <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-5">
            <Link href="/" className="flex items-center gap-2.5 font-display text-xl font-extrabold tracking-tight">
              <span className="btn-primary grid h-8 w-10 place-items-center rounded-lg" aria-hidden>
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" fill="currentColor" stroke="none" />
                </svg>
              </span>
              SkillAtlas
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/favorites" className="rounded-full px-4 py-2 font-medium text-ink hover:bg-chip">
                Favourites
              </Link>
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-8 sm:py-12">{children}</main>
        <footer className="mt-8 border-t border-line">
          <div className="mx-auto w-full max-w-7xl px-5 py-8 text-center text-sm leading-relaxed text-muted">
            SkillAtlas is a directory. Every entry belongs to its creator — we link to and credit the original source and
            never copy or host anyone&apos;s code.
          </div>
        </footer>
      </body>
    </html>
  );
}
