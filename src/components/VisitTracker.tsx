"use client";

import { useEffect } from "react";
import { callFunction } from "@/lib/track";

const KEY = "skillatlas:visit";

/** Counts one visit per browser session. Stores nothing about the visitor. */
export function VisitTracker() {
  useEffect(() => {
    try {
      if (/bot|crawl|spider|preview|headless/i.test(navigator.userAgent)) return;
      if (sessionStorage.getItem(KEY)) return;
      sessionStorage.setItem(KEY, "1");
    } catch {
      return; // storage blocked: don't count, otherwise every page would count as a visit
    }
    // If the count did not get through, forget the mark so the next page tries again.
    void callFunction("track_visit").then((ok) => {
      if (!ok) sessionStorage.removeItem(KEY);
    });
  }, []);
  return null;
}
