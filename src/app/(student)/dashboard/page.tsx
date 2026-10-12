import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";

export const metadata: Metadata = { title: "Dashboard" };

type Enrol = { course_id: string; courses: { slug: string; title: string; subtitle: string | null } };
type Recent = { completed_at: string; lessons: { title: string; slug: string; courses: { slug: string; title: string } } };
type Prog = { course_id: string; percent: number; completed_lessons: number; total_lessons: number };

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const supabase = await createClient();

  const [{ data: profile }, { data: enrolRaw }, { data: progRaw }, { data: recentRaw }, { data: certRaw }] = await Promise.all([
    supabase.from("profiles").select("first_name").eq("id", user.id).maybeSingle(),
    supabase.from("enrolments").select("course_id, courses(slug, title, subtitle)").eq("user_id", user.id).in("status", ["active", "completed"]),
    supabase.from("course_progress").select("course_id, percent, completed_lessons, total_lessons").eq("user_id", user.id),
    supabase.from("lesson_progress").select("completed_at, lessons(title, slug, courses(slug, title))").eq("user_id", user.id).eq("completed", true).order("completed_at", { ascending: false }).limit(5),
    supabase.from("certificates").select("certificate_number, issued_at, revoked, courses(title)").eq("user_id", user.id).eq("revoked", false),
  ]);
  const certs = (certRaw ?? []) as unknown as { certificate_number: string; issued_at: string; courses: { title: string } | null }[];

  const enrols = (enrolRaw ?? []) as unknown as Enrol[];
  const progress = new Map<string, Prog>(((progRaw ?? []) as unknown as Prog[]).map((p) => [p.course_id, p] as [string, Prog]));
  const recent = (recentRaw ?? []) as unknown as Recent[];
  const current = enrols.find((e) => (progress.get(e.course_id)?.percent ?? 0) < 100) ?? enrols[0];
  const name = profile?.first_name?.trim();

  return (
    <div className="space-y-20">
      <div>
        <h1 className="text-h1">{name ? `Welcome back, ${name}` : "Welcome back"}</h1>
      </div>

      {enrols.length === 0 ? (
        <EmptyState title="You're not enrolled in a course yet" body="Your account is ready. When you enrol in a course it will appear here, with your progress and a button to pick up where you left off." action={{ href: "/academy/courses", label: "Browse courses" }} secondary={{ href: "/profile", label: "Complete your profile" }} />
      ) : (
        <>
          {current && (
            <section aria-labelledby="continue" className="border border-line">
              <div className="thread h-px" aria-hidden />
              <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-12 lg:items-end">
                <div className="lg:col-span-8">
                  <h2 id="continue" className="text-caption text-ink-3">Continue learning</h2>
                  <p className="mt-3 text-h2">{current.courses.title}</p>
                  <div className="mt-6 max-w-md">
                    <ProgressBar value={progress.get(current.course_id)?.percent ?? 0} label={`${current.courses.title} progress`} />
                    <p className="mt-2 text-caption text-ink-3">{progress.get(current.course_id)?.completed_lessons ?? 0} of {progress.get(current.course_id)?.total_lessons ?? 0} lessons complete</p>
                  </div>
                </div>
                <div className="lg:col-span-4 lg:text-right"><Button href={`/learn/${current.courses.slug}`} size="lg">Continue</Button></div>
              </div>
            </section>
          )}

          <section aria-labelledby="mine">
            <h2 id="mine" className="text-h3">My courses</h2>
            <ul className="mt-6 border-t border-line">
              {enrols.map((e) => {
                const p = progress.get(e.course_id);
                return (
                  <li key={e.course_id} className="border-b border-line">
                    <Link href={`/learn/${e.courses.slug}`} className="group grid gap-4 py-6 sm:grid-cols-[1fr_16rem] sm:items-center">
                      <span className="text-h4"><span className="link-line pb-1">{e.courses.title}</span></span>
                      <span><ProgressBar value={p?.percent ?? 0} label={`${e.courses.title} progress`} /></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      {certs.length > 0 && (
        <section aria-labelledby="certs">
          <h2 id="certs" className="text-h3">Certificates</h2>
          <ul className="mt-6 border-t border-line">
            {certs.map((c) => (
              <li key={c.certificate_number} className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-4">
                <span className="text-body">{c.courses?.title}</span>
                <Link href={`/certificate/${c.certificate_number}`} className="text-label"><span className="link-line pb-0.5">View certificate {c.certificate_number}</span></Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="activity">
        <h2 id="activity" className="text-h3">Recent activity</h2>
        {recent.length === 0 ? (
          <p className="mt-4 max-w-prose text-body text-ink-2">Lessons you complete will show up here.</p>
        ) : (
          <ul className="mt-6 border-t border-line">
            {recent.map((r, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line py-4">
                <Link href={`/learn/${r.lessons.courses.slug}/${r.lessons.slug}`} className="text-body hover:underline underline-offset-4">{r.lessons.title}</Link>
                <span className="text-caption text-ink-3">{new Date(r.completed_at).toLocaleDateString("en", { day: "numeric", month: "short" })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
