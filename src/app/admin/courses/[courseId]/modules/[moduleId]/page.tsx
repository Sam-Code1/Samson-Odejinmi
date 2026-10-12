import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/PageHeader";
import { AdminForm } from "@/components/admin/AdminForm";
import { FormSection, TextAreaInput, TextInput } from "@/components/admin/FormFields";
import { renameModule } from "@/app/admin/actions/curriculum";
import { getAdminContext } from "@/lib/admin/guard";
import { isUuid } from "@/lib/admin/validation";
import type { ModuleRow } from "@/lib/admin/types";

export const metadata = { title: "Edit module" };

export default async function ModulePage({ params }: { params: Promise<{ courseId: string; moduleId: string }> }) {
  const { courseId, moduleId } = await params;
  if (!isUuid(courseId) || !isUuid(moduleId)) notFound();
  const { supabase } = (await getAdminContext())!;
  const { data } = await supabase.from("modules").select("*").eq("id", moduleId).eq("course_id", courseId).maybeSingle();
  if (!data) notFound();
  const m = data as unknown as ModuleRow;
  return (
    <>
      <PageHeader eyebrow="Module" title={m.title} subtitle={<Link href={`/admin/courses/${courseId}?tab=curriculum`} className="underline underline-offset-4">Back to curriculum</Link>} />
      <div className="max-w-2xl">
        <AdminForm action={renameModule} submitLabel="Save module">
          <input type="hidden" name="moduleId" value={m.id} />
          <FormSection title="Module">
            <TextInput label="Title" name="title" required defaultValue={m.title} />
            <TextAreaInput label="Description" name="description" rows={3} defaultValue={m.description ?? ""} />
          </FormSection>
        </AdminForm>
      </div>
    </>
  );
}
