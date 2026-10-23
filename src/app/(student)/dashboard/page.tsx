import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Award, Check, Play } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadCourse } from "@/lib/learning";
import { Pathway, Progress } from "@/components/brand/Brand";
import { CourseCard } from "@/components/brand/CourseCard";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My learning" };

type Enrol = { course_id: string; courses: { slug: string; title: string; subtitle: string | null; level: string | null; category: string | null; image_url: string | null } };
type Recent = { completed_at: string; lessons: { title: string; slug: string; courses: { slug: string; title: string } } };
type Prog = { course_id: string; percent: number; completed_lessons: number; total_lessons: number; last_lesson_id: string | null };
type Attempt = { id: string; percent: number; passed: boolean; submitted_at: string; quizzes: { title: string } | null };

/**
 * My learning (Brand Guidelines §16): resume first; the course's syllabus as a Pathway; three actionable stats from real
 * progress data; certificates. No streak flames or badges for their own sake.
 */
export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const supabase = await createClient();
  const [{ data: profile }, { data: enrolRaw }, { data: progRaw }, { data: recentRaw }, { data: certRaw }, { data: attemptRaw }] = await Promise.all([
    supabase.from("profiles").select("first_name").eq("id", user.id).maybeSingle(),
    supabase.from("enrolments").select("course_id, courses(slug, title, subtitle, level, category, image_url)").eq("user_id", user.id).in("status", ["active", "completed"]),
    supabase.from("course_progress").select("course_id, percent, completed_lessons, total_lessons, last_lesson_id").eq("user_id", user.id),
    supabase.from("lesson_progress").select("completed_at, lessons(title, slug, courses(slug, title))").eq("user_id", user.id).eq("completed", true).order("completed_at", { ascending: false }).limit(5),
    supabase.from("certificates").select("certificate_number, issued_at, revoked, courses(title)").eq("user_id", user.id).eq("revoked", false),
    supabase.from("quiz_attempts").select("id, percent, passed, submitted_at, quizzes(title)").eq("user_id", user.id).order("submitted_at", { ascending: false }).limit(5),
  ]);
  const enrols = ((enrolRaw ?? []) as unknown as Enrol[]).filter((e) => e.courses);
  const progress = new Map<string, Prog>(((progRaw ?? []) as unknown as Prog[]).map((p) => [p.course_id, p]));
  const recent = (recentRaw ?? []) as unknown as Recent[];
  const certs = (certRaw ?? []) as unknown as { certificate_number: string; issued_at: string; courses: { title: string } | null }[];
  const attempts = (attemptRaw ?? []) as unknown as Attempt[];
  const name = (profile?.first_name as string | undefined)?.trim();

  const current = enrols.find((e) => (progress.get(e.course_id)?.percent ?? 0) < 100) ?? enrols[0];
  const course = current ? await loadCourse(current.courses.slug, user.id) : null;
  const ok = course?.state === "ok" ? course : null;
  const done = new Set(ok?.completed ?? []);
  const p = current ? progress.get(current.course_id) : undefined;
  const flat = ok?.flat ?? [];
  const last = flat.find((l) => l.id === p?.last_lesson_id);
  const next = flat.find((l) => !done.has(l.id)) ?? null;
  const resume = (last && !done.has(last.id) ? last : next) ?? last ?? flat[0] ?? null;
  const resumeIndex = resume ? flat.findIndex((l) => l.id === resume.id) : -1;
  const percent = (p?.percent ?? ok?.percent ?? 0) / 100;
  const courseNo = current ? enrols.indexOf(current) + 1 : 1;

  return (
    <div className="space-y-14">
      <header>
        <p className="fa-label">My learning{name ? ` · ${name}` : ""}</p>
        <h1 className="mt-3 text-h2">{resume ? <>Continue: {resume.title}</> : name ? `Welcome back, ${name}` : "Welcome back"}</h1>
      </header>

      {enrols.length === 0 ? (
        <section className="fa-callout max-w-2xl">
          <p className="fa-label !text-blue">Start here</p>
          <p className="mt-2 text-h4">You&apos;re not enrolled in a course yet</p>
          <p className="mt-2 text-body text-ink-2">When you enrol, your course appears here with your progress and a button to pick up exactly where you left off.</p>
          <div className="mt-6 flex flex-wrap gap-3"><Link href="/academy/courses" className="fa-btn fa-btn-primary">Browse courses<ArrowRight aria-hidden className="fa-arrow h-4 w-4" /></Link><Link href="/academy/books" className="fa-btn fa-btn-secondary">Browse books</Link></div>
        </section>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            {/* Resume */}
            <section aria-label="Resume" className="fa-card flex flex-col p-5 sm:p-6">
              <p className="fa-label">Course {String(courseNo).padStart(2, "0")}{resumeIndex >= 0 ? ` · Lesson ${String(resumeIndex + 1).padStart(2, "0")}` : ""}</p>
              <Link href={resume ? `/learn/${current!.courses.slug}/${resume.slug}` : `/learn/${current!.courses.slug}`} aria-label={resume ? `Resume ${resume.title}` : `Open ${current!.courses.title}`}
                className="theme-night fa-dots group relative mt-4 grid aspect-[16/8] place-items-center overflow-hidden rounded-[6px] border border-line">
                <span className="grid h-16 w-16 place-items-center rounded-full border border-line-strong bg-elevated transition-transform duration-[160ms] group-hover:scale-[1.02]"><Play aria-hidden className="ml-1 h-6 w-6 fill-current text-ink" /></span>
              </Link>
              <div className="mt-5"><Progress value={percent} label={`${current!.courses.title} progress`} /></div>
              <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-h4">{resume?.title ?? current!.courses.title}</p>
                  <p className="mt-1 text-body-sm text-ink-2">{resume ? `${resume.moduleTitle} · ${current!.courses.title}` : current!.courses.subtitle}</p>
                </div>
                <Link href={resume ? `/learn/${current!.courses.slug}/${resume.slug}` : `/learn/${current!.courses.slug}`} className="fa-btn fa-btn-primary">{percent > 0 ? "Resume" : "Start"}<ArrowRight aria-hidden className="fa-arrow h-4 w-4" /></Link>
              </div>
            </section>

            {/* Syllabus Pathway */}
            {ok && flat.length > 0 && (
              <section aria-labelledby="path" className="fa-card p-5 sm:p-6">
                <h2 id="path" className="fa-label">{current!.courses.title} · {done.size} / {flat.length}</h2>
                <ol className="relative mt-5 max-h-[22rem] overflow-y-auto pr-1">
                  <span aria-hidden className="absolute bottom-3 left-[5px] top-3 w-px bg-line" />
                  {flat.map((l, i) => {
                    const isDone = done.has(l.id);
                    const isCurrent = resume?.id === l.id;
                    const lastOne = i === flat.length - 1;
                    return (
                      <li key={l.id}>
                        <Link href={`/learn/${current!.courses.slug}/${l.slug}`} aria-current={isCurrent ? "step" : undefined}
                          className={cn("relative flex min-h-[40px] items-center gap-4 rounded-[4px] py-1.5 pr-2 text-body-sm transition-colors hover:text-ink", isCurrent ? "font-semibold text-ink" : isDone ? "text-ink-2" : "text-ink-2")}>
                          <span aria-hidden className={cn("relative z-10 h-[11px] w-[11px] shrink-0",
                            lastOne ? (isDone ? "bg-[rgb(var(--path-end))]" : "border-[1.5px] border-line-strong bg-canvas")
                              : isCurrent ? "rounded-full bg-node shadow-[0_0_0_4px_rgb(var(--node)/0.2)]"
                                : isDone ? "rounded-full bg-[rgb(var(--path-start))]" : "rounded-full border-[1.5px] border-line-strong bg-canvas")} />
                          <span className="font-mono text-xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                          <span className="min-w-0 truncate">{l.title}</span>
                          {isDone && <span className="sr-only">(completed)</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}
          </div>

          {/* Three actionable stats (real data only) */}
          <section aria-label="Progress" className="grid gap-4 sm:grid-cols-3">
            <div className="fa-card p-5 sm:p-6">
              <p className="fa-label">Course progress</p>
              <p className="mt-3 font-mono text-[2.25rem] font-medium leading-none tracking-tight">{Math.round(percent * 100)}%</p>
              <Progress value={percent} label="Course progress" className="mt-4" />
            </div>
            <div className="fa-card p-5 sm:p-6">
              <p className="fa-label">Lessons completed</p>
              <p className="mt-3 font-mono text-[2.25rem] font-medium leading-none tracking-tight">{p?.completed_lessons ?? done.size}<span className="text-lg text-ink-3"> / {p?.total_lessons ?? flat.length}</span></p>
              <p className="mt-3 text-body-sm text-ink-2">{recent[0] ? `Last: ${recent[0].lessons.title}` : "Complete a lesson to see it here."}</p>
            </div>
            <div className="fa-card p-5 sm:p-6">
              <p className="fa-label">Next milestone</p>
              {next ? (
                <>
                  <p className="mt-3 text-h4">{next.title}</p>
                  <Link href={`/learn/${current!.courses.slug}/${next.slug}`} className="mt-2 inline-flex min-h-[32px] items-center gap-1 text-body-sm font-medium text-blue hover:underline">Open lesson<ArrowRight aria-hidden className="h-3.5 w-3.5" /></Link>
                </>
              ) : (
                <p className="mt-3 flex items-center gap-2 text-h4 text-success"><Check aria-hidden className="h-5 w-5" />Course complete</p>
              )}
            </div>
          </section>

          {enrols.length > 1 && (
            <section aria-labelledby="mine">
              <div className="flex items-end justify-between gap-4"><h2 id="mine" className="text-h3">Your courses</h2><Link href="/courses" className="fa-btn fa-btn-text">All<ArrowRight aria-hidden className="fa-arrow h-4 w-4" /></Link></div>
              <ul className="mt-6 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {enrols.map((e, i) => (
                  <li key={e.course_id}><CourseCard c={{ slug: e.courses.slug, title: e.courses.title, subtitle: e.courses.subtitle, level: e.courses.level, category: e.courses.category, imageUrl: e.courses.image_url }} index={i} progress={(progress.get(e.course_id)?.percent ?? 0) / 100} href={`/learn/${e.courses.slug}`} cta="Continue" /></li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {certs.length > 0 && (
        <section aria-labelledby="certs">
          <h2 id="certs" className="text-h3">Certificates</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {certs.map((c) => (
              <li key={c.certificate_number} className="fa-card flex items-start gap-4 p-5">
                <Award aria-hidden className="mt-0.5 h-6 w-6 shrink-0 text-node" strokeWidth={1.5} />
                <div className="min-w-0">
                  <p className="font-semibold">{c.courses?.title}</p>
                  <p className="mt-1 font-mono text-xs text-ink-3">{c.certificate_number}</p>
                  <Link href={`/verify/certificate/${c.certificate_number}`} className="mt-3 inline-flex min-h-[32px] items-center gap-1 text-body-sm font-medium text-blue hover:underline">View &amp; download<ArrowRight aria-hidden className="h-3.5 w-3.5" /></Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(recent.length > 0 || attempts.length > 0) && (
        <div className="grid gap-10 lg:grid-cols-2">
          {recent.length > 0 && (
            <section aria-labelledby="activity">
              <h2 id="activity" className="fa-label">Recent activity</h2>
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {recent.map((r, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 py-3">
                    <Link href={`/learn/${r.lessons.courses.slug}/${r.lessons.slug}`} className="min-w-0 truncate text-body-sm hover:text-blue">{r.lessons.title}</Link>
                    <span className="shrink-0 font-mono text-xs text-ink-3">{new Date(r.completed_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {attempts.length > 0 && (
            <section aria-labelledby="quizzes">
              <h2 id="quizzes" className="fa-label">Quiz results</h2>
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {attempts.map((a) => (
                  <li key={a.id} className="flex items-baseline justify-between gap-3 py-3">
                    <span className="min-w-0 truncate text-body-sm">{a.quizzes?.title ?? "Quiz"}</span>
                    <span className="shrink-0 text-body-sm"><span className="font-mono">{a.percent}%</span> <span className={a.passed ? "text-success" : "text-warm"}>{a.passed ? "✓ Passed" : "Not passed"}</span></span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
      <Pathway className="max-w-[12rem] opacity-80" />
    </div>
  );
}
