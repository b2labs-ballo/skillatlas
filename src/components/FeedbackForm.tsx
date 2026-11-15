"use client";

import { useState } from "react";
import { callFunction } from "@/lib/track";

const field = "tile w-full rounded-2xl border-line px-4 py-3 text-base text-ink placeholder:text-muted";

export function FeedbackForm() {
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [trap, setTrap] = useState(""); // hidden field: only bots fill it in
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (state === "sent") {
    return (
      <div className="tile rounded-2xl p-8 text-center" role="status">
        <p className="text-xl font-bold">Thank you!</p>
        <p className="mt-2 text-muted">Your message has been sent. It helps make SkillAtlas better.</p>
      </div>
    );
  }

  const tooShort = message.trim().length < 3;
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (tooShort || state === "sending") return;
        setState("sending");
        const ok = trap ? true : await callFunction("send_feedback", { p_message: message, p_contact: contact, p_page: document.referrer.slice(0, 300) });
        setState(ok ? "sent" : "error");
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold">What is missing, broken or could be better?</span>
        <textarea required minLength={3} maxLength={3000} rows={7} value={message} onChange={(e) => setMessage(e.target.value)} className={field} placeholder="For example: I could not find…, I would like to filter by…, this entry is wrong…" />
      </label>
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold">
          Your e-mail <span className="font-normal text-muted">(optional — only if you want a reply)</span>
        </span>
        <input type="email" maxLength={200} value={contact} onChange={(e) => setContact(e.target.value)} className={field} placeholder="you@example.com" autoComplete="email" />
      </label>
      <input type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} className="hidden" aria-hidden name="website" />
      {state === "error" && (
        <p className="rounded-2xl bg-accent-soft px-4 py-3 text-sm font-medium" role="alert">
          The message could not be sent right now. Please try again in a moment.
        </p>
      )}
      <button type="submit" disabled={tooShort || state === "sending"} className="btn-primary inline-flex h-12 items-center justify-center self-start rounded-full px-8 text-[15px] font-semibold disabled:opacity-50">
        {state === "sending" ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
