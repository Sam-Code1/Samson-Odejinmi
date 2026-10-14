"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { askAcademy } from "@/app/chatbot-actions";
import type { Suggestion } from "./ChatPanel";

// Loaded only when a visitor opens it: no chat code ships with the page.
const ChatPanel = dynamic(() => import("./ChatPanel").then((m) => m.ChatPanel), { ssr: false });

const SUGGESTIONS: Suggestion[] = [
  { label: "Which course should I start with?", prompt: "I'm a complete beginner. Which course should I start with?" },
  { label: "How much does it cost?", prompt: "How much do the courses cost?" },
  { label: "Do I get a certificate?", prompt: "Do I get a certificate when I finish?" },
  { label: "How does enrolment work?", prompt: "How do I enrol, and when do I get access?" },
];

export function AcademyChatLauncher() {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => { setOpen(false); requestAnimationFrame(() => button.current?.focus()); }, []);
  return (
    <>
      <button ref={button} type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}
        className={`${open ? "hidden" : "inline-flex"} fixed bottom-[max(env(safe-area-inset-bottom),1rem)] right-4 z-40 h-12 items-center gap-2 rounded-full bg-ink px-5 text-label text-canvas shadow-[0_12px_32px_-12px_rgb(var(--ink)/0.5)] transition-transform hover:-translate-y-0.5 sm:right-6`}>
        <MessageCircle aria-hidden className="h-4 w-4" strokeWidth={1.75} />Questions?
      </button>
      {open && (
        <ChatPanel title="Fola Academy assistant" subtitle="Answers from our course information" maxChars={600} suggestions={SUGGESTIONS} onClose={close}
          intro="Ask about our courses, prices, certificates or how enrolment works. For anything about your account or a payment, please use the contact page."
          footer="AI answers from published course info. For anything important, contact us."
          send={(messages) => askAcademy({ messages })} />
      )}
    </>
  );
}
