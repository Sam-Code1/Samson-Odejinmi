import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { loadCourse } from "@/lib/learning";

/** Sends the student to their next unfinished lesson (or the first one). */
export default async function LearnIndex({ params }: { params: Promise<{ courseSlug: string }> }) {
  const { courseSlug } = await params;
  const user = await requireUser(`/learn/${courseSlug}`);
  const data = await loadCourse(courseSlug, user.id);
  if (data.state !== "ok") return null; // layout renders the explanation
  const done = new Set(data.completed);
  const next = data.flat.find((l) => !done.has(l.id)) ?? data.flat[0];
  if (!next) return <p className="text-ink-2">Lessons for this course are still being added.</p>;
  redirect(`/learn/${courseSlug}/${next.slug}`);
}
