/** Native <details> accordion: accessible, keyboard friendly, zero client JS. */
export function Accordion({ items }: { items: { q: string; a: React.ReactNode }[] }) {
  return (
    <div className="border-t border-line">
      {items.map((item) => (
        <details key={item.q} className="group border-b border-line">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-h4 [&::-webkit-details-marker]:hidden">
            <span>{item.q}</span>
            <span aria-hidden className="relative h-4 w-4 shrink-0">
              <span className="absolute left-0 top-1/2 h-px w-4 bg-ink" />
              <span className="absolute left-1/2 top-0 h-4 w-px bg-ink transition-transform duration-base ease-quiet group-open:scale-y-0" />
            </span>
          </summary>
          <div className="max-w-prose pb-7 text-body text-ink-2">{item.a}</div>
        </details>
      ))}
    </div>
  );
}
