"use client";

import { callFunction } from "@/lib/track";

/** A download link that also adds one to the entry's download counter. */
export function DownloadLink({ slug, href, className, title, children }: { slug: string; href: string; className?: string; title?: string; children: React.ReactNode }) {
  return (
    <a href={href} rel="noopener noreferrer nofollow" className={className} title={title} onClick={() => void callFunction("track_download", { p_slug: slug })}>
      {children}
    </a>
  );
}
