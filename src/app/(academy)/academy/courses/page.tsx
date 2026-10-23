import type { Metadata } from "next";
import Link from "next/link";
import { FaContainer } from "@/components/brand/Shell";
import { Pathway } from "@/components/brand/Brand";
import { CourseCard } from "@/components/brand/CourseCard";
import { getPublishedCourses } from "@/lib/academy";
import { buildMetadata } from "@/lib/cms/seo";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("academy_courses", { title: "Courses — Fola Academy", absoluteTitle: true, description: "Fola Academy courses: mental models first, then tools, then projects with purpose.", path: "/academy/courses" });
}

/** Course catalogue (§16): numbered course cards on the 12-column grid. */
export default async function CoursesPage() {
  const courses = await getPublishedCourses();
  return (
    <>
      <section className="fa-blueprint border-b border-line">
        <FaContainer className="py-14 sm:py-20 lg:py-24">
          <p className="fa-label fa-rise">Courses · Fola Academy</p>
          <h1 className="mt-4 max-w-4xl text-display fa-rise">Learn the craft. Understand the tools.</h1>
          <p className="mt-6 max-w-prose text-body-lg text-ink-2">Every course starts with the problem a tool was invented to solve, then the tool, then a project you finish yourself.</p>
          <Pathway className="mt-8 max-w-xs" />
        </FaContainer>
      </section>
      <section className="py-14 sm:py-20">
        <FaContainer>
          {courses.length === 0 ? (
            <div className="fa-callout max-w-2xl">
              <p className="fa-label !text-blue">In preparation</p>
              <p className="mt-2 text-h4">Courses are on the way</p>
              <p className="mt-2 text-body text-ink-2">The first programme is being prepared. When a course is ready, it appears here.</p>
              <Link href="/academy/books" className="fa-btn fa-btn-secondary mt-6">Browse books meanwhile</Link>
            </div>
          ) : (
            <>
              <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{courses.map((c, i) => <li key={c.slug} className="fa-rise" style={{ animationDelay: `${i * 60}ms` }}><CourseCard c={c} index={i} /></li>)}</ul>
              <p className="mt-12 max-w-prose text-caption text-ink-3">More programmes are being developed. When they&apos;re ready, they appear here.</p>
            </>
          )}
        </FaContainer>
      </section>
    </>
  );
}
