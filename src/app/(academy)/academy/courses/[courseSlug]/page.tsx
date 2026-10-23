import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { Accordion } from "@/components/ui/Accordion";
import { FaContainer, FaSection } from "@/components/brand/Shell";
import { Callout, Pathway } from "@/components/brand/Brand";
import { SubjectIcon } from "@/components/brand/CourseCard";
import { PriceSwitcher } from "@/components/academy/PriceSwitcher";
import { BuyButtons } from "@/components/shop/CartClient";
import { course as content } from "@/content/course";
import { getPublishedCourse, getPublishedCourses } from "@/lib/academy";
import { getCoursePricing } from "@/lib/pricing";
import { getShopperCurrency, pickCurrency } from "@/lib/currency";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ courseSlug: string }> }): Promise<Metadata> {
  const { courseSlug } = await params;
  const c = await getPublishedCourse(courseSlug);
  if (!c) return { title: "Course not found", robots: { index: false } };
  const title = `${c.seoTitle ?? c.title} — Fola Academy`;
  const description = c.seoDescription ?? c.subtitle ?? undefined;
  const url = `/academy/courses/${c.slug}`;
  return {
    title: { absolute: title }, description, alternates: { canonical: url },
    openGraph: { title, description, url, type: "website", ...(c.imageUrl ? { images: [c.imageUrl] } : {}) },
    twitter: { card: c.imageUrl ? "summary_large_image" : "summary", title, description, ...(c.imageUrl ? { images: [c.imageUrl] } : {}) },
  };
}

/**
 * Course page (Brand Guidelines §16): course number + tags; promise headline; syllabus as a vertical Pathway (lesson
 * nodes, project square); outcomes; a "Why this works" callout; instructor; FAQ; sticky enrol bar.
 */
export default async function CoursePage({ params }: { params: Promise<{ courseSlug: string }> }) {
  const { courseSlug } = await params;
  const course = await getPublishedCourse(courseSlug);
  if (!course) notFound();

  const [prices, shopper, user, all] = await Promise.all([getCoursePricing(course.slug), getShopperCurrency(), getUser(), getPublishedCourses()]);
  let enrolled = false;
  if (user && course.id) {
    const supabase = await createClient();
    const { data: e } = await supabase.from("enrolments").select("id").eq("user_id", user.id).eq("course_id", course.id).in("status", ["active", "completed"]).maybeSingle();
    enrolled = !!e;
  }
  // ONE currency for the price shown and the checkout (lib/currency).
  const currency = shopper.chosen ? shopper.currency : pickCurrency(prices.map((p) => p.currency), shopper.currency, shopper.country) ?? shopper.currency;
  const shown = prices.find((p) => p.currency === currency);
  const number = Math.max(0, all.findIndex((c) => c.slug === course.slug)) + 1;
  const outcomes = [...course.learningOutcomes, ...course.objectives];
  const checkout = prices.length === 0
    ? <p className="text-body-sm text-ink-2">Enrolment for this course isn&apos;t open yet.</p>
    : <BuyButtons itemKey={`c:${course.id}`} owned={enrolled} ownedHref={`/learn/${course.slug}`} ownedLabel="Go to the course" available={!!shown} />;
  const jsonLd = { "@context": "https://schema.org", "@type": "Course", name: course.title, description: course.subtitle ?? undefined, provider: { "@type": "Organization", name: "Fola Academy" } };
  let lessonNo = 0;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <section className="fa-blueprint border-b border-line">
        <FaContainer className="grid gap-12 py-12 sm:py-16 lg:grid-cols-12 lg:py-24">
          <div className="lg:col-span-7">
            <p className="fa-label fa-rise">Course {String(number).padStart(2, "0")}{course.category ? ` · ${course.category}` : ""}</p>
            <div className="mt-5 flex flex-wrap gap-2">{course.level && <span className="fa-tag" data-dot>{course.level}</span>}{course.category && <span className="fa-tag">{course.category}</span>}<span className="fa-tag">Self-paced</span></div>
            <h1 className="mt-6 text-display fa-rise">{course.title}</h1>
            {course.subtitle && <p className="mt-7 max-w-prose text-body-lg text-ink-2">{course.subtitle}</p>}
            <dl className="mt-10 grid max-w-xl grid-cols-2 gap-x-8 gap-y-5 border-t border-line pt-6 sm:grid-cols-4">
              {course.moduleCount > 0 && <div><dt className="fa-label">Modules</dt><dd className="mt-1.5 font-mono text-lg">{course.moduleCount}</dd></div>}
              {course.lessonCount > 0 && <div><dt className="fa-label">Lessons</dt><dd className="mt-1.5 font-mono text-lg">{course.lessonCount}</dd></div>}
              {course.estimatedDuration && <div><dt className="fa-label">Duration</dt><dd className="mt-1.5 font-mono text-lg">{course.estimatedDuration}</dd></div>}
              <div><dt className="fa-label">Access</dt><dd className="mt-1.5 font-mono text-lg">Lifetime</dd></div>
            </dl>
          </div>
          <div className="lg:col-span-5">
            <div className="fa-card overflow-hidden lg:sticky lg:top-28">
              <div className="fa-dots relative aspect-[16/9] border-b border-line">
                {course.imageUrl
                  ? <Image src={course.imageUrl} alt="" fill priority sizes="(min-width: 1024px) 30rem, 100vw" className="object-cover" />
                  : <div className="absolute inset-0 grid place-items-center text-ink"><SubjectIcon subject={course.category ?? course.title} className="h-16 w-16" /></div>}
              </div>
              <div className="p-6">
                <PriceSwitcher prices={prices} currency={currency} size="md" />
                <div className="mt-6">{checkout}</div>
                <ul className="mt-6 space-y-2 border-t border-line pt-5 text-body-sm text-ink-2">
                  {["Lifetime access, self-paced", "Your progress is saved in your account", "No account needed to pay: create it right after"].map((t) => <li key={t} className="flex gap-2.5"><Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success" />{t}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </FaContainer>
      </section>

      {course.description && (
        <FaSection label="About this course" title="What this course is for">
          <div className="fa-book max-w-[68ch] space-y-5 text-ink-2">{course.description.split(/\n{2,}/).map((p) => <p key={p}>{p}</p>)}</div>
        </FaSection>
      )}

      {outcomes.length > 0 && (
        <FaSection label="Outcomes" title="What you'll be able to do">
          <ul className="grid gap-px overflow-hidden rounded-[8px] border border-line bg-line sm:grid-cols-2">
            {outcomes.map((l, i) => <li key={l} className="flex gap-4 bg-canvas p-5 sm:p-6"><span className="font-mono text-sm text-ink-3">{String(i + 1).padStart(2, "0")}</span><span className="text-body">{l}</span></li>)}
          </ul>
          <Callout label="Why this works" className="mt-10 max-w-3xl">Each lesson starts with the idea, then shows it, then lets you practise it. You finish knowing why the steps work, so they keep working after the software updates.</Callout>
        </FaSection>
      )}

      {course.modules.length > 0 && (
        <FaSection id="curriculum" label="Syllabus" title="The path through the course" intro={`${course.moduleCount} ${course.moduleCount === 1 ? "module" : "modules"} and ${course.lessonCount} ${course.lessonCount === 1 ? "lesson" : "lessons"}, in order. Lesson content is available once you're enrolled.`}>
          <ol className="relative max-w-3xl">
            <span aria-hidden className="thread-v absolute bottom-6 left-[5px] top-2 w-px opacity-70" />
            {course.modules.map((m, mi) => (
              <li key={m.position} className="relative pb-10 pl-10 last:pb-0">
                <span aria-hidden className={mi === course.modules.length - 1 ? "absolute left-0 top-1.5 h-3 w-3 bg-[rgb(var(--path-end))]" : "absolute left-0 top-1.5 h-3 w-3 rounded-full border-[1.5px] border-[rgb(var(--path-start))] bg-canvas"} />
                <p className="fa-label">Module {String(m.position).padStart(2, "0")}</p>
                <h3 className="mt-1.5 text-h4">{m.title}</h3>
                {m.lessons.length > 0 && (
                  <ul className="mt-4 divide-y divide-line rounded-[8px] border border-line">
                    {m.lessons.map((l) => { lessonNo++; return (
                      <li key={`${m.position}-${l.title}`} className="flex items-center gap-4 px-4 py-3 text-body-sm">
                        <span className="font-mono text-xs text-ink-3">{String(lessonNo).padStart(2, "0")}</span><span className="min-w-0 flex-1">{l.title}</span>
                      </li>
                    ); })}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </FaSection>
      )}

      {(course.targetAudience.length > 0 || course.requirements.length > 0) && (
        <FaSection label="Fit" title="Who it's for">
          <div className="grid gap-12 lg:grid-cols-2">
            {course.targetAudience.length > 0 && <ul className="space-y-3">{course.targetAudience.map((w) => <li key={w} className="flex gap-3 text-body"><span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-node" />{w}</li>)}</ul>}
            {course.requirements.length > 0 && <div><p className="fa-label">You&apos;ll need</p><ul className="mt-4 space-y-3">{course.requirements.map((r) => <li key={r} className="flex gap-3 text-body text-ink-2"><span aria-hidden className="mt-[0.7em] h-px w-3 shrink-0 bg-line-strong" />{r}</li>)}</ul></div>}
          </div>
        </FaSection>
      )}

      {course.instructor && (
        <FaSection label="Instructor" title={course.instructor}>
          <div className="grid items-start gap-10 lg:grid-cols-12">
            <div className="fa-frame relative aspect-[4/5] max-w-[16rem] overflow-hidden lg:col-span-3"><Image src="/images/samson-odejinmi.jpg" alt={`Portrait of ${course.instructor}`} fill sizes="16rem" className="object-cover" /></div>
            <p className="fa-book max-w-[60ch] text-ink-2 lg:col-span-8 lg:col-start-5">I&apos;m Samson Odejinmi, known as Fola. I trained in 3D Animation and Video Production in Lagos and I&apos;m exploring where 3D, programming and creative technology meet. I teach the way I wish I&apos;d been taught: understand what you&apos;re doing, and why it works.</p>
          </div>
        </FaSection>
      )}

      <FaSection label="FAQ" title="Questions">
        <div className="max-w-3xl"><Accordion items={content.faq.map((f) => ({ q: f.q, a: f.a }))} /></div>
      </FaSection>

      <section className="theme-night fa-blueprint border-t border-line">
        <FaContainer className="grid gap-10 py-20 sm:py-24 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7"><p className="fa-label">Enrol</p><h2 className="mt-4 text-h1">Ready when you are.</h2><Pathway className="mt-8 max-w-xs" /></div>
          <div className="fa-card p-6 lg:col-span-4 lg:col-start-9">{shown && <p className="mb-5 text-h3 tabular-nums">{shown.amountMinor === 0 ? "Free" : formatMoney(shown.amountMinor, shown.currency)}</p>}{checkout}</div>
        </FaContainer>
      </section>

      {shown && !enrolled && (
        <div className="sticky bottom-0 z-30 border-t border-line bg-canvas/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-[1248px] items-center justify-between gap-4">
            <div className="min-w-0"><p className="truncate text-body-sm font-semibold">{course.title}</p><p className="text-caption text-ink-2">{shown.amountMinor === 0 ? "Free" : formatMoney(shown.amountMinor, shown.currency)}</p></div>
            <Link href={`/checkout?buy=c:${course.id}`} className="fa-btn fa-btn-primary shrink-0">Enrol now</Link>
          </div>
        </div>
      )}
    </>
  );
}
