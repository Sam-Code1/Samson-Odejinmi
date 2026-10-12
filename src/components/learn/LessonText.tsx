/** Minimal, safe renderer for lesson text: paragraphs, "## " headings and "- " lists. No raw HTML is ever injected. */
export function LessonText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="space-y-5 text-body-lg text-ink-2">
      {blocks.map((b, i) => {
        if (b.startsWith("## ")) return <h2 key={i} className="pt-4 text-h3 text-ink">{b.slice(3)}</h2>;
        const lines = b.split("\n");
        if (lines.every((l) => l.startsWith("- "))) {
          return (
            <ul key={i} className="space-y-2">
              {lines.map((l, j) => <li key={j} className="flex gap-3"><span aria-hidden className="thread-solid mt-[0.8em] h-px w-4 shrink-0" />{l.slice(2)}</li>)}
            </ul>
          );
        }
        return <p key={i}>{b}</p>;
      })}
    </div>
  );
}
