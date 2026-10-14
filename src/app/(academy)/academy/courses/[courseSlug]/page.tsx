import type { Metadata } from "next";
import { headers } from "next/headers";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Container, Section, SectionHeader } from "@/components/ui/Container";
import { Accordion } from "@/components/ui/Accordion";
import { Badge } from "@/components/ui/Badge";
import { PriceSwitcher } from "@/components/academy/PriceSwitcher";
import { CourseCurriculum } from "@/components/academy/CourseCurriculum";
import { course as content } from "@/content/course";
import { getPublishedCourse } from "@/lib/academy";
import { getCoursePricing, guessCurrency } from "@/lib/pricing";
import { CheckoutPanel } from "@/components/academy/CheckoutPanel";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { payableCurrencies, paystackConfigured } from "@/lib/payments/paystack";

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

function Bullets({ items }: { items: string[] }) {
  return <ul className="space-y-3">{items.map((i) => <li key={i} className="flex gap-4 text-body"><span aria-hidden className="thread-solid mt-[0.8em] h-px w-5 shrink-0" />{i}</li>)}</ul>;
}

export default async function CoursePage({ params }: { params: Promise<{ courseSlug: string }> }) {
  const { courseSlug } = await params;
  const course = await getPublishedCourse(courseSlug);
  if (!course) notFound();

  const [prices, h, user] = await Promise.all([getCoursePricing(course.slug), headers(), getUser()]);
  let enrolled = false;
  if (user && course.id) {
    const supabase = await createClient();
    const { data: e } = await supabase.from("enrolments").select("id").eq("user_id", user.id).eq("course_id", course.id).in("status", ["active", "completed"]).maybeSingle();
    enrolled = !!e;
  }
  const checkout = <CheckoutPanel courseId={course.id} slug={course.slug} prices={prices} payable={payableCurrencies()} signedIn={!!user} enrolled={enrolled} paymentsReady={paystackConfigured()} />;
  const defaultCurrency = guessCurrency(h.get("x-vercel-ip-country"));
  const outcomes = [...course.learningOutcomes, ...course.objectives];

  const jsonLd = { "@context": "https://schema.org", "@type": "Course", name: course.title, description: course.subtitle ?? undefined, provider: { "@type": "Person", name: "Samson Afolabi Odejinmi" } };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />

      <section className="mesh grain relative overflow-hidden border-b border-line">
        <Container className="grid gap-12 pb-14 pt-14 sm:pt-20 lg:grid-cols-12 lg:pb-24 lg:pt-28">
          <div className="lg:col-span-8">
            <div className="flex flex-wrap gap-2">{course.level && <Badge>{course.level}</Badge>}{course.category && <Badge>{course.category}</Badge>}</div>
            <h1 className="mt-6 text-display">{course.title}</h1>
            {course.subtitle && <p className="mt-8 max-w-prose text-body-lg text-ink-2">{course.subtitle}</p>}
            <dl className="mt-10 flex flex-wrap gap-x-10 gap-y-4 text-body-sm">
              {course.instructor && <div><dt className="text-caption text-ink-3">Instructor</dt><dd>{course.instructor}</dd></div>}
              {course.moduleCount > 0 && <div><dt className="text-caption text-ink-3">Modules</dt><dd>{course.moduleCount}</dd></div>}
              {course.lessonCount > 0 && <div><dt className="text-caption text-ink-3">Lessons</dt><dd>{course.lessonCount}</dd></div>}
              {course.estimatedDuration && <div><dt className="text-caption text-ink-3">Duration</dt><dd>{course.estimatedDuration}</dd></div>}
              <div><dt className="text-caption text-ink-3">Format</dt><dd>Self-paced</dd></div>
              <div><dt className="text-caption text-ink-3">Access</dt><dd>Lifetime</dd></div>
            </dl>
          </div>
          <div className="lg:col-span-4">
            <div className="rounded-xl border border-line bg-elevated/80 p-6 shadow-[0_30px_60px_-34px_rgb(var(--ink)/0.45)] backdrop-blur">
              <div className="thread -mx-6 -mt-6 mb-6 h-px" aria-hidden />
              <PriceSwitcher prices={prices} defaultCurrency={defaultCurrency} size="md" />
              <div className="mt-7">{checkout}</div>
            </div>
          </div>
        </Container>
      </section>

      {course.imageUrl && (
        <Container className="-mt-2 pt-10">
          <div className="relative aspect-[16/7] overflow-hidden rounded-xl border border-line"><Image src={course.imageUrl} alt={`${course.title} course image`} fill priority sizes="(min-width: 1320px) 1220px, 100vw" className="object-cover" /></div>
        </Container>
      )}

      {course.description && (
        <Section>
          <Container className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            <h2 className="text-h2 lg:col-span-4">About this course</h2>
            <div className="space-y-5 text-body-lg text-ink-2 lg:col-span-7 lg:col-start-6">{course.description.split(/\n{2,}/).map((p) => <p key={p}>{p}</p>)}</div>
          </Container>
        </Section>
      )}

      {course.targetAudience.length > 0 && (
        <Section tone="violet">
          <Container className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            <h2 className="text-h2 lg:col-span-4">Who it&apos;s for</h2>
            <ul className="lg:col-span-7 lg:col-start-6">{course.targetAudience.map((w) => <li key={w} className="border-t border-line py-5 text-body-lg first:border-t-0 first:pt-0">{w}</li>)}</ul>
          </Container>
        </Section>
      )}

      {outcomes.length > 0 && (
        <Section>
          <Container>
            <SectionHeader title="What you'll learn" />
            <ul className="mt-12 grid gap-x-12 sm:grid-cols-2">{outcomes.map((l) => <li key={l} className="flex gap-4 border-t border-line py-6 text-body"><span aria-hidden className="thread-solid mt-[0.8em] h-px w-5 shrink-0" />{l}</li>)}</ul>
          </Container>
        </Section>
      )}

      {course.requirements.length > 0 && (
        <Section tone="mint">
          <Container className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            <h2 className="text-h2 lg:col-span-4">Requirements</h2>
            <div className="lg:col-span-7 lg:col-start-6"><Bullets items={course.requirements} /></div>
          </Container>
        </Section>
      )}

      {course.modules.length > 0 && (
        <Section tone="blue" id="curriculum">
          <Container className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            <div className="lg:col-span-4"><SectionHeader title="Curriculum" intro={`${course.moduleCount} ${course.moduleCount === 1 ? "module" : "modules"} and ${course.lessonCount} ${course.lessonCount === 1 ? "lesson" : "lessons"}, in order. Lesson content is available to enrolled students.`} /></div>
            <div className="lg:col-span-7 lg:col-start-6"><CourseCurriculum course={course} /></div>
          </Container>
        </Section>
      )}

      {course.instructor && (
        <Section tone="peach">
          <Container className="grid items-center gap-12 lg:grid-cols-12">
            <div className="lg:col-span-3">
              <div className="relative aspect-[4/5] max-w-[16rem] overflow-hidden rounded-sm"><Image src="/images/samson-odejinmi.jpg" alt={`Portrait of ${course.instructor}`} fill sizes="16rem" className="object-cover" /></div>
            </div>
            <div className="lg:col-span-8 lg:col-start-5">
              <h2 className="text-h2">Your instructor</h2>
              <p className="mt-6 max-w-prose text-body-lg text-ink-2">I&apos;m Samson Odejinmi, known as Fola. I trained in 3D Animation and Video Production in Lagos and I&apos;m exploring where 3D, programming and creative technology meet. I teach the way I wish I&apos;d been taught: understand what you&apos;re doing, and why it works.</p>
            </div>
          </Container>
        </Section>
      )}

      <Section>
        <Container className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4"><h2 className="text-h2">Price</h2><p className="mt-5 text-body text-ink-2">One-time payment, lifetime access. Self-paced.</p></div>
          <div className="lg:col-span-7 lg:col-start-6"><PriceSwitcher prices={prices} defaultCurrency={defaultCurrency} /></div>
        </Container>
      </Section>

      <Section tone="violet">
        <Container className="grid grid-cols-1 gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4"><SectionHeader title="Questions" /></div>
          <div className="lg:col-span-7 lg:col-start-6"><Accordion items={content.faq.map((f) => ({ q: f.q, a: f.a }))} /></div>
        </Container>
      </Section>

      <Section tone="night">
        <Container className="flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-end">
          <h2 className="text-h1 max-w-3xl">Ready when you are.</h2>
          <div className="w-full max-w-sm rounded-xl border border-line bg-elevated p-6">{checkout}</div>
        </Container>
      </Section>
    </>
  );
}
