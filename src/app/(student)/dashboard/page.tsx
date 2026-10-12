import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

type Enrol = { course_id: string; courses: { slug: string; title: string; subtitle: string | null } };
type Recent = { completed_at: string; lessons: { title: string; slug: string; courses: { slug: string; title: string } } };
type Prog = { course_id: string; percent: number; completed_lessons: number; total_lessons: number; last_lesson_id: string | null };
type Attempt = { id: string; percent: number; passed: boolean; submitted_at: string; quizzes: { title: string } | null };
type Purchase = { reference: string; amount_minor: number; currency: string; provider: string; status: string; paid_at: string | null; created_at: string; courses: { title: string } | null };

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const supabase = await createClient();

  const [{ data: profile }, { data: enrolRaw }, { data: progRaw }, { data: recentRaw }, { data: certRaw }, { data: attemptRaw }, { data: payRaw }] = await Promise.all([
    supabase.from("profiles").select("first_name").eq("id", user.id).maybeSingle(),
    supabase.from("enrolments").select("course_id, courses(slug, title, subtitle)").eq("user_id", user.id).in("status", ["active", "completed"]),
    supabase.from("course_progress").select("course_id, percent, completed_lessons, total_lessons, last_lesson_id").eq("user_id", user.id),
    supabase.from("lesson_progress").select("completed_at, lessons(title, slug, courses(slug, title))").eq("user_id", user.id).eq("completed", true).order("completed_at", { ascending: false }).limit(5),
    supabase.from("certificates").select("certificate_number, issued_at, revoked, courses(title)").eq("user_id", user.id).eq("revoked", false),
    supabase.from("quiz_attempts").select("id, percent, passed, submitted_at, quizzes(title)").eq("user_id", user.id).order("submitted_at", { ascending: false }).limit(5),
    supabase.from("payments").select("reference, amount_minor, currency, provider, status, paid_at, created_at, courses(title)").eq("user_id", user.id).in("status", ["successful", "refunded"]).order("created_at", { ascending: false }).limit(10),
  ]);
  const attempts = (attemptRaw ?? []) as unknown as Attempt[];
  const purchases = (payRaw ?? []) as unknown as Purchase[];
  const certs = (certRaw ?? []) as unknown as { certificate_number: string; issued_at: string; courses: { title: string } | null }[];

  const enrols = (enrolRaw ?? []) as unknown as Enrol[];
  const progress = new Map<string, Prog>(((progRaw ?? []) as unknown as Prog[]).map((p) => [p.course_id, p] as [string, Prog]));
  const recent = (recentRaw ?? []) as unknown as Recent[];
  const current = enrols.find((e) => (progress.get(e.course_id)?.percent ?? 0) < 100) ?? enrols[0];
  const name = profile?.first_name?.trim();
  const lastId = current ? progress.get(current.course_id)?.last_lesson_id : null;
  const { data: lastLesson } = lastId ? await supabase.from("lessons").select("title, slug").eq("id", lastId).maybeSingle() : { data: null };

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
                    <p className="mt-2 text-caption text-ink-3">{Math.round(progress.get(current.course_id)?.percent ?? 0)}% · {progress.get(current.course_id)?.completed_lessons ?? 0} of {progress.get(current.course_id)?.total_lessons ?? 0} lessons complete</p>
                    {lastLesson && <p className="mt-3 text-body-sm text-ink-2">Last viewed: {lastLesson.title as string}</p>}
                  </div>
                </div>
                <div className="lg:col-span-4 lg:text-right"><Button href={lastLesson ? `/learn/${current.courses.slug}/${lastLesson.slug as string}` : `/learn/${current.courses.slug}`} size="lg">Continue</Button></div>
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
                <Link href={`/verify/certificate/${c.certificate_number}`} className="text-label"><span className="link-line pb-0.5">View certificate {c.certificate_number}</span></Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {attempts.length > 0 && (
        <section aria-labelledby="quizzes">
          <h2 id="quizzes" className="text-h3">Quiz results</h2>
          <ul className="mt-6 border-t border-line">
            {attempts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line py-4">
                <span className="text-body">{a.quizzes?.title ?? "Quiz"}</span>
                <span className="text-body-sm"><span className="tabular-nums">{a.percent}%</span> <span className={a.passed ? "text-blue" : "text-warm"}>{a.passed ? "Passed" : "Not passed"}</span> <span className="text-caption text-ink-3">· {new Date(a.submitted_at).toLocaleDateString("en", { day: "numeric", month: "short" })}</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {purchases.length > 0 && (
        <section aria-labelledby="purchases">
          <h2 id="purchases" className="text-h3">Purchases</h2>
          <ul className="mt-6 border-t border-line">
            {purchases.map((p) => (
              <li key={p.reference} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line py-4">
                <span className="text-body">{p.courses?.title ?? "Course"}<span className="block text-caption text-ink-3">Ref {p.reference}</span></span>
                <span className="text-body-sm tabular-nums">{p.provider === "free" ? "Free" : formatMoney(p.amount_minor, p.currency)}{p.status === "refunded" && <span className="ml-2 text-warm">Refunded</span>}</span>
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
