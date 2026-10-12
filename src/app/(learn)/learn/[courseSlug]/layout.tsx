import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StateMessage } from "@/components/ui/States";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { CourseSidebar } from "@/components/learn/CourseSidebar";
import { LessonDrawer } from "@/components/learn/LessonDrawer";
import { requireUser } from "@/lib/auth";
import { loadCourse } from "@/lib/learning";

export const metadata = { robots: { index: false } };

export default async function LearnLayout({ children, params }: { children: React.ReactNode; params: Promise<{ courseSlug: string }> }) {
  const { courseSlug } = await params;
  const user = await requireUser(`/learn/${courseSlug}`);
  const data = await loadCourse(courseSlug, user.id);

  if (data.state !== "ok") {
    return (
      <Container>
        {data.state === "missing" ? (
          <StateMessage title="This course isn't available" body="It may have moved or isn't published yet." action={{ href: "/courses", label: "My courses" }} />
        ) : (
          <StateMessage title="This lesson is available to enrolled students." body={`Enrol in ${data.course.title} to watch the lessons, track your progress and take the quizzes. If you've already enrolled, check you're logged in with the right account.`} action={{ href: `/academy/courses/${data.course.slug}`, label: "View the course" }} secondary={{ href: "/dashboard", label: "Go to dashboard" }} />
        )}
      </Container>
    );
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center gap-5 px-5 sm:px-8">
          <LessonDrawer courseSlug={data.course.slug} modules={data.modules} completed={data.completed} quizzes={data.quizzes.filter((q) => !q.lesson_id)} />
          <Link href="/dashboard" className="hidden text-label text-ink-3 hover:text-ink sm:inline">Dashboard</Link>
          <p className="min-w-0 flex-1 truncate text-label">{data.course.title}</p>
          <div className="hidden w-40 sm:block"><ProgressBar value={data.percent} label="Course progress" /></div>
          <ThemeSwitcher />
        </div>
      </header>
      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[20rem_1fr]">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] overflow-y-auto border-r border-line p-8 lg:block">
          <CourseSidebar courseSlug={data.course.slug} modules={data.modules} completed={data.completed} quizzes={data.quizzes.filter((q) => !q.lesson_id)} />
        </aside>
        <main id="main" className="min-w-0 px-5 py-10 sm:px-10 lg:px-14 lg:py-14">{children}</main>
      </div>
    </div>
  );
}
