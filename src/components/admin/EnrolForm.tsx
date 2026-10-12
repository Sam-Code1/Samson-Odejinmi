import { enrolStudent } from "@/app/admin/actions/people";
import { AdminForm } from "./AdminForm";
import { CheckboxInput, SelectInput, TextInput } from "./FormFields";

export function EnrolForm({ courses }: { courses: { id: string; title: string }[] }) {
  return (
    <AdminForm action={enrolStudent} submitLabel="Enrol student" stickyBar={false}>
      <div className="grid gap-5 sm:grid-cols-3">
        <TextInput label="Student email" name="email" type="email" required placeholder="student@example.com" hint="They must already have an account." />
        <SelectInput label="Course" name="course_id" required options={[{ value: "", label: "Choose a course…" }, ...courses.map((c) => ({ value: c.id, label: c.title }))]} />
        <SelectInput label="Status" name="status" defaultValue="active" options={[{ value: "active", label: "Active" }, { value: "pending", label: "Pending" }, { value: "completed", label: "Completed" }]} />
      </div>
      <CheckboxInput label="I confirm this student should get access to this course" name="confirm" />
    </AdminForm>
  );
}
