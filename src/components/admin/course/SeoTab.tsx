import { saveSeo } from "@/app/admin/actions/courses";
import { AdminForm } from "../AdminForm";
import { FormSection, TextAreaInput, TextInput } from "../FormFields";
import type { CourseRow } from "@/lib/admin/types";

export function SeoTab({ course }: { course: CourseRow }) {
  return (
    <AdminForm action={saveSeo} submitLabel="Save SEO">
      <input type="hidden" name="id" value={course.id} />
      <FormSection title="Search appearance" description="How this course looks in search results and when shared. Leave empty to use the course title and short description.">
        <TextInput label="SEO title" name="seo_title" defaultValue={course.seo_title ?? ""} maxLength={70} hint="Up to 70 characters." className="sm:col-span-2" />
        <TextAreaInput label="SEO description" name="seo_description" rows={3} defaultValue={course.seo_description ?? ""} maxLength={170} hint="Up to 170 characters." className="sm:col-span-2" />
        <p className="text-caption text-ink-3 sm:col-span-2">Public URL: /academy/courses/{course.slug}. Lesson pages are never indexed.</p>
      </FormSection>
    </AdminForm>
  );
}
