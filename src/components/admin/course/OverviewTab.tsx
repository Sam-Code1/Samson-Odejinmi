import { saveCourse } from "@/app/admin/actions/courses";
import { AdminForm } from "../AdminForm";
import { FileInput, FormSection, SelectInput, TextAreaInput, TextInput } from "../FormFields";
import type { CourseRow } from "@/lib/admin/types";

export function OverviewTab({ course }: { course: CourseRow }) {
  const join = (a: string[]) => (a ?? []).join("\n");
  return (
    <AdminForm action={saveCourse} submitLabel="Save draft">
      <input type="hidden" name="id" value={course.id} />
      <FormSection title="Basics">
        <TextInput label="Title" name="title" required defaultValue={course.title} />
        <TextInput label="Slug" name="slug" required defaultValue={course.slug} hint="Used in the course URL: /academy/courses/your-slug" />
        <TextInput label="Short description" name="subtitle" defaultValue={course.subtitle ?? ""} maxLength={240} className="sm:col-span-2" hint="One sentence shown on course cards and in search results." />
        <SelectInput label="Difficulty" name="level" defaultValue={course.level ?? ""} options={[{ value: "", label: "Not set" }, { value: "Beginner", label: "Beginner" }, { value: "Intermediate", label: "Intermediate" }, { value: "Advanced", label: "Advanced" }]} />
        <TextInput label="Category" name="category" defaultValue={course.category ?? ""} placeholder="3D" />
        <TextInput label="Instructor" name="instructor" defaultValue={course.instructor ?? ""} />
        <TextInput label="Estimated duration" name="estimated_duration" defaultValue={course.estimated_duration ?? ""} hint="Only fill this in if you know it, for example “6 hours”." />
      </FormSection>
      <FormSection title="Description">
        <TextAreaInput label="Full description" name="description" rows={6} defaultValue={course.description ?? ""} />
      </FormSection>
      <FormSection title="What students get" description="One item per line.">
        <TextAreaInput label="Course objectives" name="objectives" rows={4} defaultValue={join(course.objectives)} />
        <TextAreaInput label="Learning outcomes" name="learning_outcomes" rows={4} defaultValue={join(course.learning_outcomes)} />
        <TextAreaInput label="Requirements" name="requirements" rows={4} defaultValue={join(course.requirements)} />
        <TextAreaInput label="Target audience" name="target_audience" rows={4} defaultValue={join(course.target_audience)} />
      </FormSection>
      <FormSection title="Images" description="PNG, JPG, WebP, GIF or AVIF, up to 5 MB. Leave empty to keep the current image.">
        <div>
          <FileInput label="Course image" name="image" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" />
          {course.image_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={course.image_url} alt="Current course" className="mt-3 h-24 w-40 rounded border border-line object-cover" loading="lazy" />}
        </div>
        <div>
          <FileInput label="Course thumbnail" name="thumbnail" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" />
          {course.thumbnail_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={course.thumbnail_url} alt="Current thumbnail" className="mt-3 h-24 w-24 rounded border border-line object-cover" loading="lazy" />}
        </div>
      </FormSection>
    </AdminForm>
  );
}
