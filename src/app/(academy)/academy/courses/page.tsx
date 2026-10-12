import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { CourseSummaryCard } from "@/components/academy/CourseSummaryCard";
import { EmptyState } from "@/components/ui/States";
import { getPublishedCourses } from "@/lib/academy";
import { getCoursePricing } from "@/lib/pricing";
import { buildMetadata } from "@/lib/cms/seo";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("academy_courses", { title: "Courses — Fola Academy", absoluteTitle: true, description: "Courses from Fola Academy: practical creative education, concept first.", path: "/academy/courses" });
}

export default async function CoursesPage() {
  const courses = await getPublishedCourses();
  const priced = await Promise.all(courses.map(async (c) => ({ c, prices: await getCoursePricing(c.slug) })));
  return (
    <Container className="pb-20 pt-14 sm:pt-20 lg:pt-28">
      <h1 className="text-h1">Courses</h1>
      <p className="mt-6 max-w-prose text-body-lg text-ink-2">Practical creative education, concept first.</p>
      {priced.length === 0 ? (
        <EmptyState title="Courses are on the way" body="The first programme is being prepared. More programmes are being developed. When a course is ready, it will appear here." action={{ href: "/academy", label: "Back to the Academy" }} />
      ) : (
        <>
          <div className="mt-14 space-y-6">{priced.map(({ c, prices }) => <CourseSummaryCard key={c.slug} course={c} prices={prices} />)}</div>
          <p className="mt-10 max-w-prose text-body-sm text-ink-3">More programmes are being developed. When they&apos;re ready, they&apos;ll appear here.</p>
        </>
      )}
    </Container>
  );
}
