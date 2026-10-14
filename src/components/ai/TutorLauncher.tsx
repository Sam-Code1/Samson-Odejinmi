"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { askTutor } from "@/app/tutor-actions";
import type { Suggestion } from "./ChatPanel";

// The chat UI is only downloaded when the student opens the tutor.
const ChatPanel = dynamic(() => import("./ChatPanel").then((m) => m.ChatPanel), { ssr: false });

const SUGGESTIONS: Suggestion[] = [
  { label: "Explain it simply", prompt: "Explain this lesson more simply, as if I'm a complete beginner." },
  { label: "Give an example", prompt: "Give me a concrete example of the main idea in this lesson." },
  { label: "Summarise", prompt: "Summarise this lesson in a few bullet points." },
  { label: "Key terms", prompt: "What are the key terms in this lesson, and what does each mean?" },
  { label: "Quiz me", prompt: "Give me one practice question about this lesson. Don't tell me the answer until I reply." },
  { label: "Before I move on", prompt: "What should I understand from this lesson before moving on?" },
];

export function TutorLauncher({ courseSlug, lessonSlug, lessonTitle }: { courseSlug: string; lessonSlug: string; lessonTitle: string }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => { setOpen(false); button.current?.focus(); }, []);
  return (
    <>
      <button ref={button} type="button" onClick={() => setOpen(true)} aria-expanded={open} aria-haspopup="dialog"
        className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-line-strong bg-elevated px-4 text-label text-ink transition-colors hover:border-ink">
        <Sparkles aria-hidden className="h-4 w-4 text-violet" strokeWidth={1.75} />Ask the tutor
      </button>
      {open && (
        <ChatPanel title="Lesson tutor" subtitle={lessonTitle} maxChars={1000} suggestions={SUGGESTIONS} onClose={close}
          intro="Ask about anything in this lesson. The tutor uses this lesson's material, so it's best for “why”, “what does this mean” and “show me an example” questions."
          send={(messages) => askTutor({ courseSlug, lessonSlug, messages })} />
      )}
    </>
  );
}
