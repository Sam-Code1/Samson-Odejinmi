import { CardSlide, type StackCard } from "@/components/ui/hero-preview-walls";
import type { SectionItem } from "@/lib/cms/types";

const tints = ["blue", "violet", "peach", "mint", "blue"] as const;

function StepVisual({ n, total }: { n: number; total: number }) {
  return (
    <div className="absolute inset-0 flex items-end justify-between p-4">
      <span className="text-[4.5rem] font-medium leading-none tracking-tighter text-ink/90 tabular-nums">{String(n).padStart(2, "0")}</span>
      <div className="mb-3 flex items-center gap-1.5" aria-hidden>
        {Array.from({ length: total }).map((_, i) => (
          <span key={i} className={i < n ? "thread-solid h-1 w-6 rounded-full" : "h-1 w-6 rounded-full bg-line-strong"} />
        ))}
      </div>
    </div>
  );
}

function build(items: { name: string; body: string }[], footer: (i: number) => string): StackCard[] {
  return items.map((s, i) => ({
    id: s.name,
    name: s.name,
    designation: footer(i),
    tint: tints[i % tints.length],
    content: <p>{s.body}</p>,
    visual: <StepVisual n={i + 1} total={items.length} />,
  }));
}

/** How a project goes. Steps come from the CMS (Admin → Website → Services → Process). */
export function WorkflowStack({ steps, className }: { steps: SectionItem[]; className?: string }) {
  const items = steps.filter((s) => s.title).map((s) => ({ name: s.title!, body: s.body ?? "" }));
  if (!items.length) return null;
  return <CardSlide className={className} label="How a project goes" intervalDuration={4200} controls items={build(items, (i) => `Step ${i + 1} of ${items.length}`)} />;
}

const learning = [
  { name: "Understand", body: "Learn what a thing is, and why it exists, before you touch the software." },
  { name: "Practise", body: "Try it yourself in small, focused exercises that make the idea stick." },
  { name: "Build", body: "Bring the pieces together in a complete project you made yourself." },
  { name: "Grow", body: "Carry the understanding into your own work and your next topic." },
];

/** Fola Academy's learning model. */
export function LearningStack({ className }: { className?: string }) {
  return <CardSlide className={className} label="How learning works" intervalDuration={4200} controls items={build(learning, (i) => `Stage ${i + 1} of ${learning.length}`)} />;
}
