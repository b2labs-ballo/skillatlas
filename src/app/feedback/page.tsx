import type { Metadata } from "next";
import Link from "next/link";
import { FeedbackForm } from "@/components/FeedbackForm";

export const metadata: Metadata = {
  title: "Feedback",
  description: "Tell us what is missing or what could be better on SkillAtlas.",
};

export default function FeedbackPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link href="/" className="self-start text-sm font-semibold text-accent hover:underline">
        ← Back to the directory
      </Link>
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">Help us improve</h1>
        <p className="mt-3 text-base leading-relaxed text-muted sm:text-lg">
          Missing a skill, a filter or a feature? Found something wrong? Write it here — every message is read.
        </p>
      </div>
      <FeedbackForm />
    </div>
  );
}
