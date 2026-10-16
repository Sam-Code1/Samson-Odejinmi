import { MixTitle } from "@/components/cms/RichText";
import { cn } from "@/lib/utils";

export function Container({ className, children, as: Tag = "div" }: { className?: string; children: React.ReactNode; as?: "div" | "section" | "header" | "footer" | "nav" }) {
  return <Tag className={cn("mx-auto w-full max-w-page px-5 sm:px-8 lg:px-12", className)}>{children}</Tag>;
}

export type Tone = "surface" | "blue" | "violet" | "peach" | "mint" | "night";

const tones: Record<Tone, string> = {
  surface: "bg-surface",
  blue: "bg-tint-blue",
  violet: "bg-tint-violet",
  peach: "bg-tint-peach",
  mint: "bg-tint-mint",
  night: "theme-night relative grain",
};

/** Sections alternate tint and temperature: soft base, coloured bands, and dark "night" bands. */
export function Section({ id, className, children, tone }: { id?: string; className?: string; children: React.ReactNode; tone?: Tone }) {
  return (
    <section id={id} className={cn("scroll-mt-24 py-20 sm:py-28 lg:py-36", tone && tones[tone], className)}>
      {children}
    </section>
  );
}

export function SectionHeader({ title, intro, className, as: H = "h2" }: { title: string; intro?: React.ReactNode; className?: string; as?: "h1" | "h2" }) {
  return (
    <div className={cn("max-w-3xl", className)}>
      <H className={H === "h1" ? "text-h1" : "text-h2"}><MixTitle text={title} /></H>
      {intro && <p className="mt-5 max-w-prose text-body-lg text-ink-2">{intro}</p>}
    </div>
  );
}

export function Rule({ className, strong }: { className?: string; strong?: boolean }) {
  return <div role="presentation" className={cn("h-px w-full", strong ? "bg-line-strong" : "bg-line", className)} />;
}

export function Thread({ className }: { className?: string }) {
  return <div role="presentation" className={cn("thread h-px w-full", className)} />;
}
