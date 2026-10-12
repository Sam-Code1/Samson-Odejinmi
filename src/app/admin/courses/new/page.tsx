import { PageHeader } from "@/components/admin/PageHeader";
import { AdminForm } from "@/components/admin/AdminForm";
import { FormSection, TextInput } from "@/components/admin/FormFields";
import { createCourse } from "@/app/admin/actions/courses";

export const metadata = { title: "Create course" };

export default function NewCoursePage() {
  return (
    <>
      <PageHeader eyebrow="Courses" title="Create course" subtitle="Start with a title. You'll add the details, curriculum and pricing next. New courses are always drafts." />
      <div className="max-w-2xl">
        <AdminForm action={createCourse} submitLabel="Create draft course" stickyBar={false}>
          <FormSection title="Basics">
            <TextInput label="Title" name="title" required placeholder="Blender Foundations" />
            <TextInput label="Slug" name="slug" hint="Optional. Generated from the title if left empty." />
          </FormSection>
        </AdminForm>
      </div>
    </>
  );
}
