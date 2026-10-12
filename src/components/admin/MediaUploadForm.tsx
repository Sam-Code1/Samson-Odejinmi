import { uploadMedia } from "@/app/admin/actions/resources";
import { AdminForm } from "./AdminForm";
import { FileInput, SelectInput, TextInput } from "./FormFields";

export function MediaUploadForm({ courses }: { courses: { id: string; title: string }[] }) {
  return (
    <AdminForm action={uploadMedia} submitLabel="Upload image" stickyBar={false}>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <FileInput label="Image" name="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" hint="Up to 5 MB." />
        <SelectInput label="Used for" name="kind" defaultValue="site_image" options={[
          { value: "site_image", label: "Website image" }, { value: "portfolio", label: "Portfolio image" }, { value: "og_image", label: "Social share image" }, { value: "logo", label: "Logo / icon" },
          { value: "image", label: "Course image" }, { value: "thumbnail", label: "Course thumbnail" }, { value: "lesson_image", label: "Lesson image" },
        ]} />
        <TextInput label="Alt text" name="alt_text" maxLength={200} hint="Describe the image." />
        <SelectInput label="Course (optional)" name="course_id" options={[{ value: "", label: "None" }, ...courses.map((c) => ({ value: c.id, label: c.title }))]} />
      </div>
    </AdminForm>
  );
}
