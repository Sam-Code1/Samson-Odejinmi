import { Callout } from "@/components/brand/Brand";

const CALLOUT = /^(why this works|note|watch out|key term|exercise[^:]{0,40})\s*:\s*/i;

/**
 * Safe renderer for lesson text (no raw HTML is ever injected). Reading voice: Newsreader at reading width (§08).
 *   blank line = paragraph · "## " = heading · "- " lines = list · "> " = callout; start it with
 *   "Why this works:", "Note:", "Watch out:", "Key term:" or "Exercise 3 · 15 min:" to label it (§16 callouts).
 */
export function LessonText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="fa-book space-y-5 text-ink-2">
      {blocks.map((b, i) => {
        if (b.startsWith("## ")) return <h2 key={i} className="pt-4 font-sans text-h3 text-ink">{b.slice(3)}</h2>;
        if (b.startsWith("> ")) {
          const body = b.replace(/^>\s?/gm, "");
          const m = body.match(CALLOUT);
          const label = m ? m[1].replace(/^\w/, (c) => c.toUpperCase()) : "Note";
          return <Callout key={i} label={label} tone={/watch out/i.test(label) ? "warn" : "idea"} className="font-sans">{m ? body.slice(m[0].length) : body}</Callout>;
        }
        const lines = b.split("\n");
        if (lines.every((l) => l.startsWith("- "))) {
          return (
            <ul key={i} className="space-y-2">
              {lines.map((l, j) => <li key={j} className="flex gap-3"><span aria-hidden className="mt-[0.7em] h-1.5 w-1.5 shrink-0 rounded-full bg-node" />{l.slice(2)}</li>)}
            </ul>
          );
        }
        return <p key={i}>{b}</p>;
      })}
    </div>
  );
}
