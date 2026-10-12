import { ResourceUploadForm } from "../ResourceUploadForm";
import { ResourceList } from "../ResourceList";
import { Panel } from "../PageHeader";
import type { ResourceRow } from "@/lib/admin/types";

export function ResourcesTab({ courseId, resources, modules, lessons, quizzes }: { courseId: string; resources: ResourceRow[]; modules: { id: string; title: string }[]; lessons: { id: string; title: string }[]; quizzes: { id: string; title: string }[] }) {
  return (
    <div className="space-y-6">
      <Panel title="Add a resource" description="Downloadable files and links for students. Files are stored privately and served through short-lived links."><ResourceUploadForm courseId={courseId} modules={modules} lessons={lessons} quizzes={quizzes} /></Panel>
      <Panel title="Resources for this course"><ResourceList resources={resources} lessons={lessons} modules={modules} quizzes={quizzes} /></Panel>
    </div>
  );
}
