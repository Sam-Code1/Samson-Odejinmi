import { redirect } from "next/navigation";

/** The curriculum builder lives on the course's Curriculum tab. */
export default async function Page({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  redirect(`/admin/courses/${courseId}?tab=curriculum`);
}
