import type { Metadata } from "next";
import Image from "next/image";
import { Container, Section, SectionHeader } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Accordion } from "@/components/ui/Accordion";
import { Badge } from "@/components/ui/Badge";
import { Rise, Settle, Stagger } from "@/components/ui/Motion";
import { AcademyVisual } from "@/components/visual/AcademyVisual";
import { CourseSummaryCard } from "@/components/academy/CourseSummaryCard";
import { CarouselStacked, type Slide } from "@/components/ui/carousel-07";
import { LearningStack } from "@/components/sections/StepStack";
import { getPublishedCourses } from "@/lib/academy";
import { faqAcademy } from "@/content/about";
import { getCoursePricing } from "@/lib/pricing";
import { buildMetadata } from "@/lib/cms/seo";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("academy", {
    title: "Fola Academy — Practical Creative Education",
    absoluteTitle: true,
    description: "Practical creative education for people who want to understand how things are made, not simply which buttons to press. Start with Blender Foundations.",
    path: "/academy",
  });
}

const flow = ["Concept", "Demonstration", "Practice", "Project"];
const audience = ["Complete beginners", "Aspiring 3D artists", "Students", "Designers", "Animators", "Self-taught creatives", "People curious about Blender", "People overwhelmed by tutorials"];
const model = [
  { name: "Understand", body: "Learn what a thing is, and why it exists, before you touch the software." },
  { name: "Practise", body: "Try it yourself in small, focused exercises that make the idea stick." },
  { name: "Build", body: "Bring the pieces together in a complete project you made yourself." },
  { name: "Grow", body: "Carry the understanding into your own work and your next topic." },
];
const resources = ["Guides", "Blueprints", "Workbooks", "Cheat sheets"];

export default async function AcademyPage() {
  const courses = await getPublishedCourses();
  const course = courses[0] ?? null;
  const prices = course ? await getCoursePricing(course.slug) : [];
  const moduleSlides: Slide[] = course
    ? course.modules.filter((m) => m.lessons.length > 0).map((m) => ({
        id: String(m.position), title: m.title, description: `${m.lessons.length} ${m.lessons.length === 1 ? "lesson" : "lessons"}, starting with "${m.lessons[0].title}".`,
        badge: `Module ${m.position}`, href: `/academy/courses/${course.slug}#curriculum`,
      }))
    : [];

  return (
    <>
      <section className="mesh grain relative overflow-hidden border-b border-line">
        <Settle className="pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] lg:block [mask-image:linear-gradient(90deg,transparent,#000_35%)]">
          <AcademyVisual className="h-full w-full" />
        </Settle>
        <Container className="relative pb-14 pt-14 sm:pt-20 lg:pb-28 lg:pt-28">
          <Stagger className="max-w-3xl">
            <Rise><p className="text-label text-ink-3">Fola Academy</p></Rise>
            <Rise>
              <h1 className="mt-5 text-display">
                <span className="block">Learn the idea.</span>
                <span className="block">Understand the process.</span>
                <span className="block">Build something real.</span>
              </h1>
            </Rise>
            <Rise>
              <p className="mt-8 max-w-[34rem] text-body-lg text-ink-2">Practical creative education for people who want to understand how things are made, not simply which buttons to press.</p>
            </Rise>
            <Rise>
              <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
                <Button href="/academy/courses" size="lg">Explore courses</Button>
                <Button href="#how" variant="text">How it works</Button>
              </div>
            </Rise>
          </Stagger>
          <div className="relative mt-14 aspect-[4/3] overflow-hidden rounded-sm border border-line lg:hidden">
            <AcademyVisual className="absolute inset-0 h-full w-full" />
          </div>
        </Container>
      </section>

      <Section id="why">
        <Container className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <h2 className="text-h1">Learning creative software shouldn&apos;t feel like learning a cockpit.</h2>
          </div>
          <div className="lg:col-span-5 lg:col-start-8">
            <p className="text-body-lg text-ink-2">Open Blender for the first time and you meet hundreds of buttons. Many beginner tutorials ask you to follow along first and understand later, so you can finish a lesson and still not know why it worked.</p>
            <p className="mt-5 text-body-lg text-ink-2">Fola Academy turns that around. Each topic starts with the idea, then shows it, then lets you practise it, then puts it to use.</p>
          </div>
          <ol className="grid gap-8 sm:grid-cols-4 lg:col-span-12">
            {flow.map((f, i) => (
              <li key={f} className="relative border-t border-line pt-6">
                <span aria-hidden className="thread-solid absolute -top-px left-0 h-px w-12" />
                <span className="text-caption tabular-nums text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                <p className="mt-2 text-h3">{f}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Section>

      <Section tone="violet">
        <Container className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionHeader title="Who it's for" intro="Fola Academy starts at the beginning. It isn't trying to be for everyone or every level yet." />
          </div>
          <div className="lg:col-span-6 lg:col-start-7">
            <ul className="flex flex-wrap gap-3">
              {audience.map((a) => <li key={a} className="rounded-full border border-line-strong bg-elevated/70 px-4 py-2 text-label">{a}</li>)}
            </ul>
            <div className="mt-10 border-t border-line pt-6">
              <p className="text-h4">Not the right fit yet</p>
              <p className="mt-2 max-w-prose text-body-sm text-ink-2">If you want advanced, specialised training, or a promise of becoming a professional in a few weeks, this isn&apos;t that. The first programme is a beginner foundation.</p>
            </div>
          </div>
        </Container>
      </Section>

      <Section id="how" tone="blue">
        <Container>
          <div className="grid items-center gap-14 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <SectionHeader title="How learning works" intro="Four stages, in order. Each one builds on the one before." />
              <ol className="mt-8 space-y-2 text-body-sm text-ink-2">
                {model.map((m, i) => <li key={m.name}><span className="tabular-nums text-ink-3">{String(i + 1).padStart(2, "0")}</span> &nbsp;{m.name}</li>)}
              </ol>
            </div>
            <div className="flex justify-center pb-6 lg:col-span-7"><LearningStack /></div>
          </div>
        </Container>
      </Section>

      <Section id="course">
        <Container>
          <SectionHeader title="The first course" />
          <div className="mt-12">
            {course ? <CourseSummaryCard course={course} prices={prices} /> : <p className="max-w-prose text-body text-ink-2">The first course is being prepared. It will appear here as soon as it&apos;s ready.</p>}
          </div>
        </Container>
      </Section>

      {course && moduleSlides.length > 0 && (
      <Section tone="night">
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeader title={`What's inside ${course.title}`} intro={`${course.moduleCount} ${course.moduleCount === 1 ? "module" : "modules"}, ${course.lessonCount} ${course.lessonCount === 1 ? "lesson" : "lessons"}.`} />
            <Button href={`/academy/courses/${course.slug}#curriculum`} variant="text">Full curriculum</Button>
          </div>
          <div className="mt-10"><CarouselStacked slides={moduleSlides} label="Course modules" /></div>
        </Container>
      </Section>
      )}

      <Section tone="peach" id="resources">
        <Container>
          <SectionHeader title="Resources" intro="Guides and practice material will live here as they're finished. Nothing is published yet." />
          <ul className="mt-12 grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {resources.map((r) => (
              <li key={r} className="flex min-h-36 flex-col justify-between bg-elevated p-6">
                <p className="text-h4">{r}</p>
                <Badge className="self-start">Coming soon</Badge>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section id="instructor">
        <Container className="grid items-center gap-14 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="relative aspect-[4/5] max-w-sm overflow-hidden rounded-sm">
              <Image src="/images/samson-odejinmi.jpg" alt="Portrait of Samson Odejinmi, instructor" fill sizes="(min-width: 1024px) 24rem, 80vw" className="object-cover" />
              <span aria-hidden className="thread-v absolute inset-y-0 left-0 w-px" />
            </div>
          </div>
          <div className="lg:col-span-7 lg:col-start-6">
            <h2 className="text-h2">About the instructor</h2>
            <div className="mt-8 space-y-5 text-body-lg text-ink-2">
              <p>I&apos;m Samson Afolabi Odejinmi, known as Fola. I became interested in animation and 3D around 2020, with limited access to the resources and equipment to pursue it fully. I later trained in 3D Animation and Video Production at Del-York Creative Academy in Lagos, and took part in physical 3D training with YAPI in Lagos.</p>
              <p>I&apos;m currently exploring where 3D, programming and creative technology meet, with Technical Direction as a long-term goal. Fola Academy is where I&apos;m building the kind of learning I want beginners to have: practical, structured, and focused on understanding what you&apos;re doing and why it works.</p>
            </div>
            <div className="mt-8"><Button href="/about" variant="text">More about Samson</Button></div>
          </div>
        </Container>
      </Section>

      <Section tone="mint">
        <Container className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h2 className="text-h2">More programmes</h2>
            <p className="mt-5 text-body text-ink-2">More programmes are being developed. When a course is ready, it appears here.</p>
          </div>
        </Container>
      </Section>

      <Section>
        <Container className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4"><SectionHeader title="Questions" /></div>
          <div className="lg:col-span-7 lg:col-start-6"><Accordion items={faqAcademy.map((f) => ({ q: f.q, a: f.a }))} /></div>
        </Container>
      </Section>

      <Section tone="night">
        <Container className="flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-end">
          <h2 className="text-h1 max-w-3xl">{course ? "Start with the foundations." : "New courses are on the way."}</h2>
          <Button href={course ? `/academy/courses/${course.slug}` : "/academy/courses"} size="lg">{course ? `See ${course.title}` : "See courses"}</Button>
        </Container>
      </Section>
    </>
  );
}
