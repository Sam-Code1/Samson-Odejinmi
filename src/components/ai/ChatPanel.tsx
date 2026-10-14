"use client";

import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import { ArrowUp, X } from "lucide-react";
import type { ChatMessage, ChatReply } from "@/app/tutor-actions";
import { cn } from "@/lib/utils";

export type Suggestion = { label: string; prompt: string };

/**
 * Shared AI chat surface (student tutor + public Academy assistant).
 * Mobile: full-screen sheet with a keyboard-safe input bar. ≥640px: a side panel that leaves the page usable.
 * Replies are rendered as plain text (paragraphs, "- " bullets, **bold**): never as HTML.
 * Conversations live only in this component's memory; nothing is stored in the browser.
 */
export function ChatPanel({ title, subtitle, intro, suggestions, maxChars, send, onClose, footer }: {
  title: string; subtitle?: string; intro: string; suggestions: Suggestion[]; maxChars: number;
  send: (messages: ChatMessage[]) => Promise<ChatReply>; onClose: () => void; footer?: React.ReactNode;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLTextAreaElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    setShown(true);
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  const ask = (text: string) => {
    const content = text.trim();
    if (!content || pending) return;
    if (content.length > maxChars) { setError(`Please keep it under ${maxChars} characters.`); return; }
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setDraft("");
    setError(null);
    start(async () => {
      const res = await send(next);
      if (res.ok) { setMessages((m) => [...m, { role: "assistant", content: res.reply }]); setRemaining(res.remaining); }
      else { setError(res.error); setMessages((m) => m.slice(0, -1)); setDraft(content); }
    });
  };

  return (
    <div role="dialog" aria-modal="false" aria-label={title}
      className={cn(
        "fixed inset-0 z-[70] flex flex-col bg-canvas transition-[opacity,transform] duration-base ease-quiet",
        "sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[26rem] sm:border-l sm:border-line sm:shadow-[0_0_80px_-20px_rgb(var(--ink)/0.35)]",
        shown ? "translate-y-0 opacity-100 sm:translate-x-0" : "translate-y-4 opacity-0 sm:translate-x-6 sm:translate-y-0",
      )}>
      <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line px-5 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <div className="min-w-0 pt-1">
          <p className="text-label">{title}</p>
          {subtitle && <p className="truncate text-caption text-ink-3">{subtitle}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded text-ink-2 hover:text-ink"><X aria-hidden className="h-5 w-5" /></button>
      </header>
      <span aria-hidden className="thread h-px shrink-0" />

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5" aria-live="polite">
        {messages.length === 0 ? (
          <div>
            <p className="text-body-sm text-ink-2">{intro}</p>
            {suggestions.length > 0 && (
              <ul className="mt-5 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <li key={s.label}><button type="button" onClick={() => ask(s.prompt)} disabled={pending}
                    className="min-h-[44px] rounded-full border border-line-strong px-4 text-body-sm text-ink-2 transition-colors hover:border-ink hover:text-ink disabled:opacity-50">{s.label}</button></li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <ol className="space-y-4">
            {messages.map((m, i) => (
              <li key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[88%] rounded-lg px-4 py-3 text-body-sm", m.role === "user" ? "bg-ink text-canvas" : "border border-line bg-elevated text-ink")}>
                  {m.role === "assistant" ? <Formatted text={m.content} /> : <p className="whitespace-pre-wrap break-words">{m.content}</p>}
                </div>
              </li>
            ))}
            {pending && (
              <li className="flex justify-start" aria-label="Thinking">
                <div className="flex items-center gap-1.5 rounded-lg border border-line bg-elevated px-4 py-4">
                  {[0, 1, 2].map((d) => <span key={d} aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-ink-3" style={{ animationDelay: `${d * 150}ms` }} />)}
                </div>
              </li>
            )}
          </ol>
        )}
        {error && <p role="alert" className="mt-4 border-l-2 border-warm pl-3 text-body-sm text-ink-2">{error}</p>}
      </div>

      <form className="shrink-0 border-t border-line bg-canvas px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3"
        onSubmit={(e) => { e.preventDefault(); ask(draft); }}>
        <div className="flex items-end gap-2">
          <label htmlFor="chat-input" className="sr-only">Your message</label>
          <textarea id="chat-input" ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} rows={1} maxLength={maxChars}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(draft); } }}
            placeholder="Ask a question…"
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-lg border border-line-strong bg-transparent px-3 py-2.5 text-base text-ink placeholder:text-ink-3 focus:border-blue-soft focus:outline-none focus:ring-2 focus:ring-blue/30 sm:text-body-sm" />
          <button type="submit" disabled={pending || !draft.trim()} aria-label="Send"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ink text-canvas transition-opacity disabled:opacity-40"><ArrowUp aria-hidden className="h-5 w-5" /></button>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 text-meta text-ink-3">
          <span>{footer ?? "AI can make mistakes. Check important details."}</span>
          {remaining !== null && <span className="shrink-0 tabular-nums">{remaining} left</span>}
        </div>
      </form>
    </div>
  );
}

/** Minimal safe formatting for AI replies: paragraphs, "- " lists, **bold**. Everything is React text. */
function Formatted({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (s: string) => s.split(/\*\*([^*]+)\*\*/g).map((p, i) => (i % 2 ? <strong key={i} className="font-semibold">{p}</strong> : <Fragment key={i}>{p}</Fragment>));
  return (
    <div className="space-y-2.5 break-words">
      {blocks.map((b, i) => {
        const lines = b.split("\n").filter((l) => l.trim());
        if (lines.length && lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
          return <ul key={i} className="space-y-1 pl-4">{lines.map((l, j) => <li key={j} className="list-disc">{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""))}</li>)}</ul>;
        }
        return <p key={i} className="whitespace-pre-wrap">{inline(b.trim())}</p>;
      })}
    </div>
  );
}
