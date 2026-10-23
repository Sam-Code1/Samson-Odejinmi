import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { WorkGallery } from "@/components/studio/WorkGallery";
import { GALLERY_CATEGORIES, categoryOf, getGallery, isGalleryCategory } from "@/lib/gallery";
import { getProjects } from "@/lib/cms";
import { buildMetadata } from "@/lib/cms/seo";
import { cn } from "@/lib/utils";

export const revalidate = 600;

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ c?: string }> }): Promise<Metadata> {
  const { c } = await searchParams;
  const cat = isGalleryCategory(c) ? categoryOf(c) : null;
  return buildMetadata("portfolio", {
    title: cat ? `${cat.label} — Work — Samson Odejinmi` : "Work — Samson Odejinmi",
    absoluteTitle: true,
    description: cat?.blurb ?? "Environment design, product animation, 3D, graphic design, video, AI automation and software by Samson Odejinmi.",
    path: cat ? `/work?c=${cat.id}` : "/work",
  });
}

const W = "mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10";

/** The work: a magazine of every piece, filterable by discipline (?c=…). Server-rendered; the viewer is the only JS. */
export default async function WorkPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const [all, projects] = await Promise.all([getGallery(), getProjects()]);
  const cat = isGalleryCategory(c) ? categoryOf(c)! : null;
  const items = cat ? all.filter((i) => i.category === cat.id) : all;
  const count = (id: string) => all.filter((i) => i.category === id).length;
  const caseStudies = projects.filter((p) => !p.placeholder).length;

  return (
    <>
      <section className="border-b border-line">
        <div className={`${W} pb-10 pt-12 sm:pt-16 lg:pt-20`}>
          <p className="fa-label st-rise">Work · {String(all.length).padStart(2, "0")} pieces</p>
          <h1 className="mt-4 text-display st-rise">{cat ? <>{cat.label}</> : <>The <span className="st-em">work.</span></>}</h1>
          <p className="mt-6 max-w-2xl text-body-lg text-ink-2">{cat?.blurb ?? "Environments, products, characters, brands and software. Select a piece to see it full size."}</p>
        </div>
        <nav aria-label="Disciplines" className={`${W} st-strip flex gap-2 overflow-x-auto pb-5`}>
          {[{ id: "", label: "All", n: all.length }, ...GALLERY_CATEGORIES.map((g) => ({ id: g.id, label: g.short, n: count(g.id) }))].map((t) => {
            const on = (cat?.id ?? "") === t.id;
            return (
              <Link key={t.id || "all"} href={t.id ? `/work?c=${t.id}` : "/work"} aria-current={on ? "page" : undefined} scroll={false}
                className={cn("inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors", on ? "border-ink bg-ink text-canvas" : "border-line text-ink-2 hover:border-line-strong hover:text-ink", t.n === 0 && !on && "opacity-60")}>
                {t.label}<span className="font-mono text-[0.7rem] opacity-70">{t.n}</span>
              </Link>
            );
          })}
        </nav>
      </section>

      <section className="py-10 sm:py-14">
        <div className={W}>
          {items.length > 0 ? <WorkGallery items={items} layout="masonry" /> : (
            <div className="max-w-xl rounded-[4px] border border-line p-8">
              <p className="fa-label">{cat?.label}</p>
              <p className="mt-3 text-h3">New work is being added here.</p>
              <p className="mt-2 text-body text-ink-2">{cat?.id === "software-engineering" ? "Websites and apps I've built are on their way. Want one built for you?" : "This part of the portfolio is being filled in. In the meantime, see the other disciplines."}</p>
              <Link href="/contact" className="mt-6 inline-flex h-11 items-center gap-1.5 rounded-full bg-action px-5 text-sm font-semibold text-on-action">Start a project<ArrowUpRight aria-hidden className="h-4 w-4" /></Link>
            </div>
          )}
          {caseStudies > 0 && (
            <p className="mt-14 border-t border-line pt-6 text-body text-ink-2">Want the story behind the work? <Link href="/portfolio" className="font-semibold text-ink underline underline-offset-4 hover:text-blue">Read the case studies</Link>.</p>
          )}
        </div>
      </section>
    </>
  );
}
