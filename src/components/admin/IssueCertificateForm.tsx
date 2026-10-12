import { issueCertificate } from "@/app/admin/actions/people";
import { AdminForm } from "./AdminForm";
import { CheckboxInput, SelectInput, TextInput } from "./FormFields";

export function IssueCertificateForm({ courses }: { courses: { id: string; title: string }[] }) {
  return (
    <AdminForm action={issueCertificate} submitLabel="Issue certificate" stickyBar={false}>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput label="Student email" name="email" type="email" required />
        <SelectInput label="Course" name="course_id" options={[{ value: "", label: "Choose a course…" }, ...courses.map((c) => ({ value: c.id, label: c.title }))]} />
        <CheckboxInput label="I confirm this student completed the course" name="confirm" className="sm:col-span-2" hint="Certificates are normally issued automatically on completion. Use this for verified exceptions only. The student must be enrolled." />
      </div>
    </AdminForm>
  );
}
