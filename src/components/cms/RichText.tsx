import { Fragment } from "react";
import { cn } from "@/lib/utils";
export { plainTitle } from "@/lib/showcase";

/**
 * CMS text is plain text, never HTML (no XSS surface). Two tiny conventions:
 *   - a blank line starts a new paragraph
 *   - *words in asterisks* get the accent emphasis used in the hero cards
 */
const accents = ["text-blue", "text-violet", "text-warm", "text-blue"];

export function Emph({ text, accent = 0 }: { text: string; accent?: number }) {
  const parts = text.split(/\*([^*]+)\*/g);
  return (
    <>
      {parts.map((p, i) => (i % 2 === 1 ? <span key={i} className={cn("font-semibold", accents[accent % accents.length])}>{p}</span> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}

export function paragraphs(text: string | null | undefined): string[] {
  return (text ?? "").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

export function Paragraphs({ text, className }: { text: string | null | undefined; className?: string }) {
  const ps = paragraphs(text);
  if (!ps.length) return null;
  return (
    <div className={className}>
      {ps.map((p, i) => <p key={i}><Emph text={p} /></p>)}
    </div>
  );
}

/**
 * Display titles: heavy sans with *marked words* in italic serif ("Selected *work*", "Habit *flow* tracker").
 * `caps` upper-cases the sans parts only, for the product-shot cards.
 */
export function MixTitle({ text, caps = false }: { text: string; caps?: boolean }) {
  const parts = text.split(/\*([^*]+)\*/g);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1
          ? <span key={i} className="font-serif text-[1.08em] font-normal normal-case italic tracking-normal">{p}</span>
          : caps ? <span key={i} className="uppercase">{p}</span> : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  );
}

/** Splits on single newlines (used for multi-line headlines). */
export function Lines({ text }: { text: string }) {
  return <>{text.split("\n").map((l, i) => <span key={i} className="block">{l}</span>)}</>;
}
