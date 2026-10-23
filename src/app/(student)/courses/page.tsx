import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CourseCard } from "@/components/brand/CourseCard";

export const metadata: Metadata = { title: "My courses" };

type Row = { course_id: string; status: string; courses: { slug: string; title: string; subtitle: string | null; level: string | null; category: string | null; image_url: string | null } | null };

export default async function MyCoursesPage() {
  const user = await requireUser("/courses");
  const supabase = await createClient();
  const [{ data: raw }, { data: prog }] = await Promise.all([
    supabase.from("enrolments").select("course_id, status, courses(slug, title, subtitle, level, category, image_url)").eq("user_id", user.id).in("status", ["active", "completed"]),
    supabase.from("course_progress").select("course_id, percent").eq("user_id", user.id),
  ]);
  const rows = ((raw ?? []) as unknown as Row[]).filter((r) => r.courses);
  const pct = new Map<string, number>((prog ?? []).map((p) => [p.course_id as string, Number(p.percent)] as [string, number]));

  return (
    <div className="space-y-10">
      <header>
        <p className="fa-label">Courses</p>
        <h1 className="mt-3 text-h2">My courses</h1>
      </header>
      {rows.length === 0 ? (
        <section className="fa-callout max-w-2xl">
          <p className="fa-label !text-blue">No courses yet</p>
          <p className="mt-2 text-body text-ink-2">Courses you enrol in appear here with your progress.</p>
          <Link href="/academy/courses" className="fa-btn fa-btn-primary mt-6">Browse courses<ArrowRight aria-hidden className="fa-arrow h-4 w-4" /></Link>
        </section>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((r, i) => {
            const v = (pct.get(r.course_id) ?? 0) / 100;
            return (
              <li key={r.course_id}>
                <CourseCard c={{ slug: r.courses!.slug, title: r.courses!.title, subtitle: r.courses!.subtitle, level: r.courses!.level, category: r.courses!.category, imageUrl: r.courses!.image_url }}
                  index={i} progress={v} href={`/learn/${r.courses!.slug}`} cta={v >= 1 ? "Completed" : v > 0 ? "Continue" : "Start"} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
