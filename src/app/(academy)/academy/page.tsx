import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Accordion } from "@/components/ui/Accordion";
import { NewsletterSignup } from "@/components/academy/NewsletterSignup";
import { FaContainer, FaSection } from "@/components/brand/Shell";
import { Callout, IsoF, Pathway } from "@/components/brand/Brand";
import { CourseCard } from "@/components/brand/CourseCard";
import { BOOKS, BookCard, BookCover, PriceTag, bookHref } from "@/components/books/BookParts";
import { getPublishedCourses } from "@/lib/academy";
import { getPublicOffers, pct } from "@/lib/affiliate";
import { faqAcademy } from "@/content/about";
import { buildMetadata } from "@/lib/cms/seo";
import { byNewest, getPublishedProducts, getShopSettings, latestOf, TYPE_LABELS } from "@/lib/products";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("academy", {
    title: "Fola Academy — Creative & Technical Education",
    absoluteTitle: true,
    description: "Making 3D, design and creative technology easier to understand. Courses, books and resources that teach how creative tools work, and why.",
    path: "/academy",
  });
}

const PHILOSOPHY = [
  { n: "01", title: "Learn the craft.", body: "Foundations that outlast any version number." },
  { n: "02", title: "Understand the tools.", body: "Every button explained by the problem it solves." },
  { n: "03", title: "Build with purpose.", body: "Projects that end in something real." },
];
const METHOD = [
  { title: "Idea", body: "Learn what a thing is, and why it exists, before you touch the software." },
  { title: "Demonstration", body: "See it done once, slowly, with the reasoning said out loud." },
  { title: "Practice", body: "Small, focused exercises that make the idea stick." },
  { title: "Project", body: "Bring the pieces together in something you made yourself." },
];

/**
 * Fola Academy homepage (Brand Guidelines §16): blueprint-grid hero with the positioning line, one framed hero object,
 * two CTAs; philosophy band; course grid; latest book; method; founder note; questions.
 * Prices on this cached page are shown in every currency a book is sold in (no guessing the visitor's currency).
 */
export default async function AcademyPage() {
  const [courses, products, shop, offers] = await Promise.all([getPublishedCourses(), getPublishedProducts(), getShopSettings(), getPublicOffers()]);
  const topRate = offers.reduce((m, o) => Math.max(m, o.rate_bps), 0);
  const books = shop.enabled ? products.filter((p) => p.type !== "course") : [];
  // The newest book leads (a newly published edition replaces an older one), then the rest, newest first.
  const latest = latestOf(books);
  const more = books.filter((b) => b.id !== latest?.id).sort(byNewest).slice(0, 4);
  const first = courses[0] ?? null;

  return (
    <>
      {/* Hero */}
      <section className="fa-blueprint border-b border-line">
        <FaContainer className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-12 lg:gap-10 lg:py-28">
          <div className="lg:col-span-7">
            <p className="fa-label fa-rise">Creative &amp; technical education</p>
            {/* A long positioning line: h1 scale (the display size is kept for short headlines, §08 "one per view"). */}
            <h1 className="mt-5 text-h1 !text-[clamp(2.5rem,1.7rem+2.9vw,4.5rem)] !font-extrabold !leading-[0.98] fa-rise" style={{ animationDelay: "60ms" }}>Making 3D, design and creative technology easier to understand.</h1>
            <p className="mt-7 max-w-[36rem] text-body-lg text-ink-2 fa-rise" style={{ animationDelay: "120ms" }}>Courses, books and resources that teach how creative tools work, and why.</p>
            <div className="mt-10 flex flex-wrap gap-3 fa-rise" style={{ animationDelay: "180ms" }}>
              <Link href="/academy/courses" className="fa-btn fa-btn-primary fa-btn-lg">Explore courses<ArrowRight aria-hidden className="fa-arrow h-4 w-4" /></Link>
              {latest ? <Link href={bookHref(latest)} className="fa-btn fa-btn-secondary fa-btn-lg">Read the first chapter</Link> : <Link href="#method" className="fa-btn fa-btn-secondary fa-btn-lg">How we teach</Link>}
            </div>
          </div>
          <figure className="lg:col-span-5">
            <div className="fa-frame relative mx-auto aspect-[5/4] max-w-lg border border-line bg-surface">
              <IsoF className="absolute inset-0 h-full w-full p-[8%]" />
            </div>
            <figcaption className="fa-label mt-4 text-center lg:text-left">Fig. 00 — The constructed F</figcaption>
          </figure>
        </FaContainer>
      </section>

      {/* Philosophy band */}
      <section aria-label="Philosophy" className="theme-night border-b border-line bg-canvas">
        <FaContainer className="grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
          {PHILOSOPHY.map((p) => (
            <div key={p.n} className="py-10 md:px-8 md:py-14 md:first:pl-0">
              <p className="font-mono text-xs text-ink-3">{p.n}</p>
              <p className="mt-3 text-h4">{p.title}</p>
              <p className="mt-2 text-body-sm text-ink-2">{p.body}</p>
            </div>
          ))}
        </FaContainer>
      </section>

      {/* Courses */}
      <FaSection id="courses" label="Courses" title="Start with understanding" action={<Link href="/academy/courses" className="fa-btn fa-btn-text">All courses<ArrowRight aria-hidden className="fa-arrow h-4 w-4" /></Link>}>
        {courses.length ? (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c, i) => <li key={c.slug}><CourseCard c={c} index={i} /></li>)}
          </ul>
        ) : <p className="max-w-prose text-body text-ink-2">The first course is being prepared. It appears here as soon as it&apos;s ready.</p>}
      </FaSection>

      {/* Latest book */}
      {latest && (
        <FaSection id="books" label="Books" title="The latest book" action={<Link href={BOOKS} className="fa-btn fa-btn-text">All books<ArrowRight aria-hidden className="fa-arrow h-4 w-4" /></Link>}>
          <div className="grid items-center gap-12 lg:grid-cols-12">
            <div className="fa-dots fa-frame mx-auto w-full max-w-sm rounded-[8px] border border-line px-[14%] py-[9%] lg:col-span-4">
              <BookCover name={latest.name} image={latest.coverImage} type={latest.type} sizes="(min-width: 1024px) 20rem, 70vw" />
            </div>
            <div className="lg:col-span-7 lg:col-start-6">
              <span className="fa-tag" data-dot>{TYPE_LABELS[latest.type]}</span>
              <h3 className="mt-4 text-h1"><Link href={bookHref(latest)} className="hover:text-blue">{latest.name}</Link></h3>
              {latest.shortDescription && <p className="fa-quote mt-5 max-w-prose text-[1.375rem] leading-snug text-ink-2">{latest.shortDescription}</p>}
              <p className="mt-6 text-h4">{latest.prices.length ? latest.prices.map((p) => <PriceTag key={p.currency} p={{ prices: [p] }} currency={p.currency} className="mr-4" />) : null}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href={bookHref(latest)} className="fa-btn fa-btn-primary">Get the book<ArrowRight aria-hidden className="fa-arrow h-4 w-4" /></Link>
                <Link href={BOOKS} className="fa-btn fa-btn-secondary">Browse all books</Link>
              </div>
            </div>
          </div>
          {more.length > 0 && (
            <ul className="mt-16 grid grid-cols-1 gap-x-6 gap-y-12 xs:grid-cols-2 lg:grid-cols-4">
              {more.map((b, i) => <li key={b.id}><BookCard p={b} currency={b.prices[0]?.currency ?? "NGN"} index={i + 1} /></li>)}
            </ul>
          )}
        </FaSection>
      )}

      {/* Affiliate programme: open to everyone, so visitors know it exists */}
      <section id="affiliate" aria-labelledby="aff-title" className="theme-night border-t border-line bg-canvas">
        <FaContainer className="grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="fa-label">Affiliate programme</p>
            <h2 id="aff-title" className="mt-3 text-h2">Share Fola Academy. Earn from every sale.</h2>
            <p className="mt-4 max-w-prose text-body-lg text-ink-2">Know someone who&apos;d love a course or a book? Get your own link for each one and earn a commission when they buy{topRate > 0 ? <>, up to <strong className="text-ink">{pct(topRate)}</strong> per sale</> : null}. You don&apos;t have to be a student: anyone with a free account can apply.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/affiliates" className="fa-btn fa-btn-primary">How it works<ArrowRight aria-hidden className="fa-arrow h-4 w-4" /></Link>
              <Link href="/affiliate" className="fa-btn fa-btn-secondary">Become an affiliate</Link>
            </div>
          </div>
          <ol className="grid gap-px overflow-hidden rounded-[8px] border border-line bg-line lg:col-span-5">
            {["Apply with a free account", "Share a link to any course or book", "Earn when someone buys"].map((t, i) => (
              <li key={t} className="flex items-center gap-4 bg-canvas p-5">
                <span className="font-mono text-xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-body">{t}</span>
              </li>
            ))}
          </ol>
        </FaContainer>
      </section>

      {/* Method */}
      <FaSection id="method" label="How we teach" title="Mental models first, then tools, then projects." intro="Most creative education starts with the software. We start one layer deeper, with the problem each tool was invented to solve. Once you understand the problem, the buttons explain themselves.">
        <ol className="grid gap-px overflow-hidden rounded-[8px] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {METHOD.map((m, i) => (
            <li key={m.title} className="flex flex-col bg-canvas p-6">
              <div className="flex items-center gap-3">
                <span aria-hidden className={i === 0 ? "h-3 w-3 rounded-full border-[1.5px] border-[rgb(var(--path-start))]" : i === METHOD.length - 1 ? "h-3 w-3 bg-[rgb(var(--path-end))]" : "h-px w-3 bg-line-strong"} />
                <span className="font-mono text-xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <p className="mt-5 text-h4">{m.title}</p>
              <p className="mt-2 text-body-sm text-ink-2">{m.body}</p>
            </li>
          ))}
        </ol>
        <Callout label="Why this works" className="mt-10 max-w-3xl">Software changes. Understanding compounds. When you know why a tool exists, you can learn the next version, or the next tool, on your own.</Callout>
      </FaSection>

      {/* Founder note */}
      <FaSection id="about" label="About" title={<span id="instructor">A note from the founder</span>}>
        <div className="grid items-start gap-12 lg:grid-cols-12">
          <figure className="lg:col-span-4">
            <div className="fa-frame relative aspect-[4/5] max-w-sm overflow-hidden">
              <Image src="/images/samson-portrait.webp" alt="Portrait of Samson Afolabi Odejinmi, founder of Fola Academy" fill sizes="(min-width: 1024px) 24rem, 80vw" className="object-cover" />
            </div>
            <figcaption className="fa-label mt-4">Samson Afolabi Odejinmi · Founder</figcaption>
          </figure>
          <div className="fa-book space-y-5 text-ink-2 lg:col-span-7 lg:col-start-6">
            <p>I&apos;m Samson Afolabi Odejinmi, known as Fola. I became interested in animation and 3D around 2020, with limited access to the resources and equipment to pursue it fully. I later trained in 3D Animation and Video Production at Del-York Creative Academy in Lagos, and took part in physical 3D training with YAPI in Lagos.</p>
            <p>I&apos;m exploring where 3D, programming and creative technology meet, with Technical Direction as a long-term goal. Fola Academy is where I&apos;m building the learning I wanted as a beginner: practical, structured, and focused on understanding what you&apos;re doing and why it works.</p>
            <Pathway className="!mt-8 max-w-xs" />
            <Link href="/about" className="fa-btn fa-btn-text font-sans">More about Samson<ArrowRight aria-hidden className="fa-arrow h-4 w-4" /></Link>
          </div>
        </div>
      </FaSection>

      {/* Questions + newsletter */}
      <FaSection label="Questions" title="Before you start">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-7"><Accordion items={faqAcademy.map((f) => ({ q: f.q, a: f.a }))} /></div>
          <div className="lg:col-span-4 lg:col-start-9"><NewsletterSignup title="Get the first look" body="New courses and books, when they're ready. No spam; unsubscribe with one click." /></div>
        </div>
      </FaSection>

      {/* Closing */}
      <section className="theme-night fa-blueprint border-t border-line">
        <FaContainer className="flex flex-col items-start justify-between gap-10 py-20 sm:py-28 lg:flex-row lg:items-end">
          <div>
            <p className="fa-label">Start here</p>
            <h2 className="mt-4 max-w-3xl text-h1">{first ? "Start with the foundations." : "New courses are on the way."}</h2>
          </div>
          <Link href={first ? `/academy/courses/${first.slug}` : "/academy/courses"} className="fa-btn fa-btn-primary fa-btn-lg">{first ? `Begin ${first.title}` : "See courses"}<ArrowRight aria-hidden className="fa-arrow h-4 w-4" /></Link>
        </FaContainer>
      </section>
    </>
  );
}
