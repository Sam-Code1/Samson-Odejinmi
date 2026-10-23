import Link from "next/link";
import { X } from "lucide-react";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { CourseSidebar } from "@/components/learn/CourseSidebar";
import { LessonDrawer } from "@/components/learn/LessonDrawer";
import { FMark, Pathway } from "@/components/brand/Brand";
import { requireUser } from "@/lib/auth";
import { loadCourse } from "@/lib/learning";
import { academyRoot } from "@/app/fonts";

export const metadata = { robots: { index: false } };

/**
 * Course player (Brand Guidelines §16): a focused reading/viewing frame. Slim header with the course Pathway as
 * progress; the syllabus as nodes in a side rail on surface-raised; video always on Night (see the lesson page).
 * The header is a solid bar (no backdrop blur) so the mobile lesson drawer isn't clipped by it.
 */
export default async function LearnLayout({ children, params }: { children: React.ReactNode; params: Promise<{ courseSlug: string }> }) {
  const { courseSlug } = await params;
  const user = await requireUser(`/learn/${courseSlug}`);
  const data = await loadCourse(courseSlug, user.id);

  if (data.state !== "ok") {
    return (
      <div className={academyRoot("grid min-h-dvh place-items-center px-4")}>
        <div className="fa-callout w-full max-w-xl">
          <p className="fa-label !text-blue">{data.state === "missing" ? "Not available" : "Enrolment required"}</p>
          <p className="mt-2 text-h3">{data.state === "missing" ? "This course isn't available" : "This lesson is for enrolled students"}</p>
          <p className="mt-2 text-body text-ink-2">{data.state === "missing" ? "It may have moved or isn't published yet." : `Enrol in ${data.course.title} to watch the lessons, track your progress and take the quizzes. Already enrolled? Check you're signed in with the right account.`}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={data.state === "missing" ? "/courses" : `/academy/courses/${data.course.slug}`} className="fa-btn fa-btn-primary">{data.state === "missing" ? "My courses" : "View the course"}</Link>
            <Link href="/dashboard" className="fa-btn fa-btn-secondary">My learning</Link>
          </div>
        </div>
      </div>
    );
  }

  const quizzes = data.quizzes.filter((q) => !q.lesson_id);
  return (
    <div className={academyRoot("min-h-dvh")}>
      <header className="sticky top-0 z-30 border-b border-line bg-canvas">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
          <LessonDrawer courseSlug={data.course.slug} modules={data.modules} completed={data.completed} quizzes={quizzes} />
          <Link href="/dashboard" aria-label="My learning" className="hidden lg:inline-flex"><FMark className="h-8 w-8" /></Link>
          <div className="min-w-0 flex-1">
            <p className="fa-label hidden !text-[0.6rem] sm:block">Course</p>
            <p className="truncate text-sm font-semibold">{data.course.title}</p>
          </div>
          <div className="hidden w-48 items-center gap-3 md:flex">
            <Pathway value={data.percent / 100} label="Course progress" className="flex-1" />
          </div>
          <span className="shrink-0 font-mono text-xs text-ink-3" aria-hidden>{Math.round(data.percent)}%</span>
          <ThemeSwitcher />
          <Link href="/dashboard" aria-label="Close the course player" className="grid h-11 w-11 place-items-center rounded-[6px] text-ink-2 hover:text-ink"><X aria-hidden className="h-5 w-5" /></Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1600px] lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] overflow-y-auto border-r border-line bg-elevated/40 px-6 py-8 lg:block">
          <CourseSidebar courseSlug={data.course.slug} modules={data.modules} completed={data.completed} quizzes={quizzes} />
        </aside>
        <main id="main" className="min-w-0 px-4 py-8 sm:px-8 lg:px-12 lg:py-12">{children}</main>
      </div>
    </div>
  );
}
