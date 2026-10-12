import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { PreviewLink } from "@/components/admin/PageSections";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { TabNav } from "@/components/admin/TabNav";
import { OverviewTab } from "@/components/admin/course/OverviewTab";
import { CurriculumTab } from "@/components/admin/course/CurriculumTab";
import { PricingTab } from "@/components/admin/course/PricingTab";
import { ResourcesTab } from "@/components/admin/course/ResourcesTab";
import { SeoTab } from "@/components/admin/course/SeoTab";
import { PublishingTab } from "@/components/admin/course/PublishingTab";
import { getAdminContext } from "@/lib/admin/guard";
import { first, isUuid } from "@/lib/admin/validation";
import type { CourseRow, LessonRow, ModuleRow, ResourceRow } from "@/lib/admin/types";

export const metadata = { title: "Edit course" };
const TABS = [{ key: "overview", label: "Overview" }, { key: "curriculum", label: "Curriculum" }, { key: "pricing", label: "Pricing" }, { key: "resources", label: "Resources" }, { key: "seo", label: "SEO" }, { key: "publishing", label: "Publishing" }];

export default async function CourseEditor({ params, searchParams }: { params: Promise<{ courseId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { courseId } = await params;
  if (!isUuid(courseId)) notFound();
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === first(sp.tab)) ? (first(sp.tab) as string) : "overview";
  const { supabase } = (await getAdminContext())!;

  const { data: courseRaw } = await supabase.from("courses").select("*").eq("id", courseId).maybeSingle();
  if (!courseRaw) notFound();
  const course = courseRaw as unknown as CourseRow;
  const base = `/admin/courses/${courseId}`;

  let body: React.ReactNode;
  if (tab === "overview") body = <OverviewTab course={course} />;
  else if (tab === "seo") body = <SeoTab course={course} />;
  else if (tab === "curriculum") {
    const [m, l] = await Promise.all([
      supabase.from("modules").select("*").eq("course_id", courseId).order("position"),
      supabase.from("lessons").select("id, module_id, course_id, slug, position, title, status, is_preview, lesson_type").eq("course_id", courseId).order("position"),
    ]);
    body = <CurriculumTab courseId={courseId} modules={(m.data ?? []) as unknown as ModuleRow[]} lessons={(l.data ?? []) as unknown as LessonRow[]} />;
  } else if (tab === "pricing") {
    const { data } = await supabase.from("course_pricing").select("currency, amount_minor, active").eq("course_id", courseId);
    body = <PricingTab courseId={courseId} prices={(data ?? []) as { currency: string; amount_minor: number; active: boolean }[]} />;
  } else if (tab === "resources") {
    const [r, m, l, q] = await Promise.all([
      supabase.from("lesson_resources").select("*").eq("course_id", courseId).order("created_at", { ascending: false }),
      supabase.from("modules").select("id, title").eq("course_id", courseId).order("position"),
      supabase.from("lessons").select("id, title").eq("course_id", courseId).order("position"),
      supabase.from("quizzes").select("id, title").eq("course_id", courseId),
    ]);
    body = <ResourcesTab courseId={courseId} resources={(r.data ?? []) as unknown as ResourceRow[]} modules={(m.data ?? []) as { id: string; title: string }[]} lessons={(l.data ?? []) as { id: string; title: string }[]} quizzes={(q.data ?? []) as { id: string; title: string }[]} />;
  } else {
    const [m, l, p] = await Promise.all([
      supabase.from("modules").select("id", { count: "exact", head: true }).eq("course_id", courseId),
      supabase.from("lessons").select("id", { count: "exact", head: true }).eq("course_id", courseId).eq("status", "published"),
      supabase.from("course_pricing").select("id", { count: "exact", head: true }).eq("course_id", courseId).eq("active", true),
    ]);
    body = <PublishingTab course={course} modules={m.count ?? 0} publishedLessons={l.count ?? 0} pricingRows={p.count ?? 0} />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Course"
        title={course.title}
        subtitle={`/${course.slug}`}
        actions={<><StatusBadge status={course.status} />{course.status === "draft" && <PreviewLink path={`/academy/courses/${course.slug}`} label="Preview course page" />}{course.status === "published" &&<Link href={`/academy/courses/${course.slug}`} className="inline-flex h-10 items-center gap-2 rounded border border-line-strong px-4 text-label hover:border-ink">View in Academy<ExternalLink aria-hidden className="h-3.5 w-3.5" /></Link>}</>}
      />
      <TabNav tabs={TABS} current={tab} basePath={base} />
      {body}
    </>
  );
}
