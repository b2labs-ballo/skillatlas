"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the visitor can still select the text by hand */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-white/15 px-4 text-sm font-semibold text-white hover:bg-white/25"
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {copied ? <path d="m5 12.5 4.5 4.5L19 7.5" /> : <path d="M9 9h10v11H9zM5 15V4h10" />}
      </svg>
      <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}
