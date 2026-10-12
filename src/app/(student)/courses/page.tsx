import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/States";

export const metadata: Metadata = { title: "My courses" };

type Row = { course_id: string; courses: { slug: string; title: string; subtitle: string | null } };

export default async function MyCoursesPage() {
  const user = await requireUser("/courses");
  const supabase = await createClient();
  const [{ data: raw }, { data: prog }] = await Promise.all([
    supabase.from("enrolments").select("course_id, courses(slug, title, subtitle)").eq("user_id", user.id).in("status", ["active", "completed"]),
    supabase.from("course_progress").select("course_id, percent").eq("user_id", user.id),
  ]);
  const rows = (raw ?? []) as unknown as Row[];
  const pct = new Map<string, number>((prog ?? []).map((p) => [p.course_id as string, Number(p.percent)] as [string, number]));

  return (
    <div>
      <h1 className="text-h1">My courses</h1>
      {rows.length === 0 ? (
        <EmptyState title="No courses yet" body="Courses you're enrolled in will appear here." action={{ href: "/academy/courses", label: "Browse courses" }} />
      ) : (
        <ul className="mt-12 border-t border-line">
          {rows.map((r) => (
            <li key={r.course_id} className="border-b border-line">
              <Link href={`/learn/${r.courses.slug}`} className="group grid gap-4 py-8 sm:grid-cols-[1fr_16rem] sm:items-center">
                <span>
                  <span className="block text-h3"><span className="link-line pb-1">{r.courses.title}</span></span>
                  {r.courses.subtitle && <span className="mt-2 block text-body-sm text-ink-2">{r.courses.subtitle}</span>}
                </span>
                <span><ProgressBar value={pct.get(r.course_id) ?? 0} label={`${r.courses.title} progress`} /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
