import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Paragraphs, plainTitle } from "@/components/cms/RichText";
import { WhatsAppButton } from "@/components/showcase/WhatsAppButton";
import { WorkGallery } from "@/components/studio/WorkGallery";
import { DisciplineIndex } from "@/components/studio/DisciplineIndex";
import { FMark, Pathway } from "@/components/brand/Brand";
import { whatsappHref } from "@/lib/showcase";
import { getPage, getProjects, getSiteSettings } from "@/lib/cms";
import { buildMetadata } from "@/lib/cms/seo";
import { canOptimize } from "@/lib/cms/images";
import { byCategory, getGallery, selectedWork } from "@/lib/gallery";
import { site } from "@/lib/site";
import { AcademyShelf } from "@/components/studio/AcademyShelf";
import { getPublishedCourses } from "@/lib/academy";
import { getPublishedProducts, getShopSettings } from "@/lib/products";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("home", { path: "/", absoluteTitle: true });
}

const W = "mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10";

/**
 * Home: a creative portfolio that gets to the work fast. Name and role, the work itself, the disciplines as an index,
 * a strip per discipline, about, Fola Academy, and one clear way to get in touch. No heavy 3D scene in the hero:
 * the first screen is text + one optimised photograph, so it paints immediately.
 * Words come from Admin → Website → Homepage; the work comes from Admin → Website → Gallery.
 */
export default async function HomePage() {
  const [page, projects, settings, gallery, courses, products, shop] = await Promise.all([getPage("home"), getProjects(), getSiteSettings(), getGallery(), getPublishedCourses(), getPublishedProducts(), getShopSettings()]);
  const books = shop.enabled ? products.filter((p) => p.type !== "course").slice(0, 4) : [];
  const hero = page.hero, about = page.about_preview, academy = page.academy, contact = page.contact_cta, statement = page.statement;
  const disciplines = byCategory(gallery);
  const filled = disciplines.filter((d) => d.items.length > 0);
  const caseStudies = projects.filter((p) => p.featured && !p.placeholder).slice(0, 3);
  const whatsapp = whatsappHref(settings.whatsappNumber, settings.whatsappMessage);
  const jsonLd = { "@context": "https://schema.org", "@type": "Person", name: settings.fullName, alternateName: [settings.siteName, site.alias], url: site.url, ...(settings.jobTitle ? { jobTitle: settings.jobTitle } : {}) };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-line">
        <div className={`${W} grid items-end gap-10 pb-12 pt-12 sm:pt-16 lg:grid-cols-12 lg:gap-8 lg:pb-16 lg:pt-20`}>
          <div className="lg:col-span-8">
            <p className="fa-label st-rise">{hero?.eyebrow ?? "Portfolio · 3D · Design · Technology"}</p>
            <h1 className="mt-5 text-display st-rise" style={{ animationDelay: "60ms" }}>
              Samson<br />Odejinmi<span className="text-[rgb(var(--node))]">.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-[clamp(1.375rem,1.1rem+1vw,2rem)] leading-[1.2] tracking-[-0.02em] text-ink-2 st-rise" style={{ animationDelay: "120ms" }}>
              <span className="st-em text-ink">3D artist, designer</span> and creative technologist, building worlds, brands and the software behind them.
            </p>
            {hero?.body && <Paragraphs text={hero.body} className="mt-5 max-w-xl space-y-3 text-body text-ink-3 st-rise" />}
            <div className="mt-9 flex flex-wrap gap-3 st-rise" style={{ animationDelay: "180ms" }}>
              <Link href="/work" className="inline-flex h-12 items-center gap-2 rounded-full bg-action px-6 text-[0.9375rem] font-semibold text-on-action transition-colors hover:bg-action-hover">See the work<ArrowRight aria-hidden className="h-4 w-4" /></Link>
              <Link href={hero?.cta2?.href ?? "/contact"} className="inline-flex h-12 items-center gap-2 rounded-full border border-line-strong px-6 text-[0.9375rem] font-semibold hover:border-ink">{hero?.cta2?.label ?? "Start a project"}</Link>
            </div>
          </div>
          <figure className="lg:col-span-4">
            <div className="fa-frame relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-[4px] bg-[#2a3a5a] lg:max-w-none">
              <Image src="/images/samson-portrait.webp" alt={`Portrait of ${settings.fullName}`} fill priority sizes="(min-width: 1024px) 30vw, 90vw" className="object-cover object-[50%_20%]" />
            </div>
            <figcaption className="fa-label mt-4 flex justify-between gap-4"><span>{settings.fullName}</span><span>Fola</span></figcaption>
          </figure>
        </div>
        {/* Discipline marquee */}
        <div className="marquee border-t border-line py-4" data-paused="false" aria-hidden>
          <div className="marquee-track" style={{ ["--marquee-duration" as string]: "38s" }}>
            {[0, 1].map((dup) => (
              <div key={dup} className={dup ? "marquee-dup flex" : "flex"}>
                {disciplines.map((d) => <span key={d.id + dup} className="flex items-center gap-6 px-6 text-sm font-semibold uppercase tracking-[0.08em] text-ink-2">{d.label}<span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--node))]" /></span>)}
              </div>
            ))}
          </div>
        </div>
      </section>

      {statement?.title && (
        <section className="border-b border-line">
          <div className={`${W} py-16 sm:py-24`}><p className="max-w-5xl text-h1">{plainTitle(statement.title)}</p></div>
        </section>
      )}

      {/* ── Selected work ── */}
      {gallery.length > 0 && (
        <section id="work" className="border-b border-line py-16 sm:py-24">
          <div className={W}>
            <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
              <div><p className="fa-label">Selected work</p><h2 className="mt-3 text-h2">Made to be <span className="st-em">looked at</span>, built to work.</h2></div>
              <Link href="/work" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold hover:text-blue">All work<ArrowUpRight aria-hidden className="h-4 w-4" /></Link>
            </div>
            <WorkGallery items={selectedWork(gallery, 9, 3)} layout="feature" />
          </div>
        </section>
      )}

      {/* ── Discipline index ── */}
      <section className="border-b border-line py-16 sm:py-24">
        <div className={W}>
          <div className="mb-10"><p className="fa-label">Disciplines</p><h2 className="mt-3 text-h2">One studio, <span className="st-em">seven crafts.</span></h2></div>
          <DisciplineIndex rows={disciplines.map((d) => ({ id: d.id, label: d.label, group: d.group, blurb: d.blurb, items: d.items.slice(0, 6) }))} />
        </div>
      </section>

      {/* ── A strip per discipline (only disciplines that have work) ── */}
      {filled.map((d, i) => (
        <section key={d.id} aria-labelledby={`d-${d.id}`} className="border-b border-line py-14 sm:py-20">
          <div className={W}>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                <p className="fa-label">{String(i + 1).padStart(2, "0")} · {d.group}</p>
                <h2 id={`d-${d.id}`} className="mt-3 text-h3">{d.label}</h2>
                <p className="mt-2 text-body-sm text-ink-2">{d.blurb}</p>
              </div>
              <Link href={`/work?c=${d.id}`} className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold hover:text-blue">View {d.items.length} <ArrowUpRight aria-hidden className="h-4 w-4" /></Link>
            </div>
            <WorkGallery items={d.items.slice(0, 10)} layout="strip" />
          </div>
        </section>
      ))}

      {/* ── Case studies (from Admin → Website → Portfolio) ── */}
      {caseStudies.length > 0 && (
        <section className="border-b border-line py-16 sm:py-24">
          <div className={W}>
            <div className="mb-10 flex flex-wrap items-end justify-between gap-6"><div><p className="fa-label">Case studies</p><h2 className="mt-3 text-h2">How the work <span className="st-em">came together.</span></h2></div><Link href="/portfolio" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold hover:text-blue">All case studies<ArrowUpRight aria-hidden className="h-4 w-4" /></Link></div>
            <ul className="grid gap-6 md:grid-cols-3">
              {caseStudies.map((p) => (
                <li key={p.id}>
                  <Link href={`/portfolio/${p.slug}`} className="st-tile group block">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-[4px] bg-surface">{p.coverImage && <Image src={p.coverImage.src} alt={p.coverImage.alt ?? ""} fill sizes="(min-width: 768px) 30vw, 100vw" unoptimized={!canOptimize(p.coverImage.src)} className="object-cover" />}</div>
                    <p className="fa-label mt-4">{p.category ?? "Project"}</p>
                    <p className="mt-1 text-h4 group-hover:text-blue">{p.title}</p>
                    {p.shortDescription && <p className="mt-1 line-clamp-2 text-body-sm text-ink-2">{p.shortDescription}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── About ── */}
      <section className="border-b border-line py-16 sm:py-24">
        <div className={`${W} grid items-center gap-12 lg:grid-cols-12`}>
          <figure className="lg:col-span-7">
            <div className="relative aspect-[16/9] overflow-hidden rounded-[4px] bg-[#16161c]">
              <Image src="/images/samson-studio.webp" alt={`${settings.fullName} in the studio`} fill sizes="(min-width: 1024px) 56vw, 100vw" className="object-cover" />
            </div>
            <figcaption className="fa-label mt-4">In the studio</figcaption>
          </figure>
          <div className="lg:col-span-5">
            <p className="fa-label">About</p>
            <h2 className="mt-3 text-h2">{about?.title ? plainTitle(about.title) : <>Curious about <span className="st-em">how things are made.</span></>}</h2>
            <Paragraphs text={about?.body ?? "I'm Samson Afolabi Odejinmi, known as Fola: a 3D artist, designer and creative technologist. I build environments and products in 3D, design for brands, and write the software that ties it together."} className="mt-6 space-y-4 text-body-lg text-ink-2" />
            <Link href={about?.cta?.href ?? "/about"} className="mt-8 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold hover:text-blue">{about?.cta?.label ?? "More about me"}<ArrowUpRight aria-hidden className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      {/* ── Fola Academy (the bridge to the Academy's own design) ── */}
      <section className="theme-night border-b border-line">
        <div className={`${W} grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-12`}>
          <div className="lg:col-span-7">
            <div className="flex items-center gap-3"><FMark className="h-8 w-8" /><p className="fa-label">{academy?.eyebrow ?? "Fola Academy"}</p></div>
            <h2 className="mt-5 text-h2">{academy?.title ? plainTitle(academy.title) : <>I also teach what I do: <span className="st-em">the why, not just the buttons.</span></>}</h2>
            <Paragraphs text={academy?.body ?? "Fola Academy makes 3D, design and creative technology easier to understand, through courses and books."} className="mt-5 max-w-xl space-y-3 text-body-lg text-ink-2" />
            <Pathway className="mt-8 max-w-[16rem]" />
          </div>
          <div className="flex flex-wrap gap-3 lg:col-span-5 lg:justify-end">
            <Link href={academy?.cta?.href ?? "/academy"} className="inline-flex h-12 items-center gap-2 rounded-full bg-action px-6 text-[0.9375rem] font-semibold text-on-action hover:bg-action-hover">{academy?.cta?.label ?? "Visit Fola Academy"}<ArrowRight aria-hidden className="h-4 w-4" /></Link>
            <Link href="/academy/books" className="inline-flex h-12 items-center gap-2 rounded-full border border-line-strong px-6 text-[0.9375rem] font-semibold hover:border-ink">Books</Link>
            <Link href="/academy/courses" className="inline-flex h-12 items-center gap-2 rounded-full border border-line-strong px-6 text-[0.9375rem] font-semibold hover:border-ink">Courses</Link>
          </div>
        </div>
      </section>

      <AcademyShelf books={books} courses={courses.slice(0, 3)} />

      {/* ── Contact ── */}
      <section>
        <div className={`${W} flex flex-col items-start justify-between gap-10 py-20 sm:py-28 lg:flex-row lg:items-end`}>
          <h2 className="max-w-4xl text-h1">{contact?.title ? plainTitle(contact.title) : <>Got a project? <span className="st-em">Let&apos;s talk.</span></>}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Link href={contact?.cta?.href ?? "/contact"} className="inline-flex h-14 items-center gap-2 rounded-full bg-action px-7 text-base font-semibold text-on-action hover:bg-action-hover">{contact?.cta?.label ?? "Start a project"}<ArrowUpRight aria-hidden className="h-4 w-4" /></Link>
            {whatsapp && <WhatsAppButton href={whatsapp} size="lg" />}
          </div>
        </div>
      </section>
    </>
  );
}
