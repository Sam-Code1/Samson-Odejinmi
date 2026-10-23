import { saveLaunchNote, setCertificateQuizRule, setCertificates, setCourseStatus } from "@/app/admin/actions/courses";
import { AdminForm } from "../AdminForm";
import { TextInput } from "../FormFields";
import { Panel } from "../PageHeader";
import { StatusBadge } from "../StatusBadge";
import { ActionButton } from "../ActionButton";
import { Check, Minus } from "lucide-react";
import type { CourseRow } from "@/lib/admin/types";
import { formatDate } from "@/lib/admin/validation";

export function PublishingTab({ course, modules, publishedLessons, pricingRows }: { course: CourseRow; modules: number; publishedLessons: number; pricingRows: number }) {
  const checks = [
    { ok: !!course.title && !!course.slug, label: "Title and slug", required: true },
    { ok: publishedLessons > 0, label: `At least one published lesson (${publishedLessons})`, required: true },
    { ok: modules > 0, label: `Modules (${modules})`, required: false },
    { ok: pricingRows > 0, label: "A price for at least one currency", required: false },
    { ok: !!course.subtitle && !!course.description, label: "Short and full description", required: false },
  ];
  const canPublish = checks.filter((c) => c.required).every((c) => c.ok);
  const f = (to: string) => ({ courseId: course.id, to, confirm: "yes" });
  return (
    <div className="space-y-6">
      <Panel title="Status">
        <div className="flex flex-wrap items-center gap-3"><StatusBadge status={course.status} />{course.published_at && <span className="text-caption text-ink-3">First published {formatDate(course.published_at)}</span>}</div>
        <p className="mt-3 max-w-xl text-body-sm text-ink-2">
          {{
            published: "This course is live in the Academy and open for enrolment. Unpublishing hides it from visitors; enrolled students keep their progress.",
            coming_soon: "Coming soon: visitors can see the course, its outline and its price (if you've set one), but nobody can enrol or pay until you publish it.",
            archived: "This course is archived and hidden everywhere. Restore it to draft to edit and publish again.",
            draft: "This course is a draft. Only admins can see it.",
          }[course.status]}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {course.status !== "published" && <ActionButton action={setCourseStatus} fields={f("published")} variant="primary" disabled={!canPublish} className="h-10 px-4 text-label" confirm={{ title: "Publish this course?", body: "It will appear in the Academy and open for enrolment and payment straight away. Make sure the curriculum and pricing are ready.", label: "Publish course" }}>Publish course</ActionButton>}
          {(course.status === "draft" || course.status === "published") && <ActionButton action={setCourseStatus} fields={f("coming_soon")} variant="outline" className="h-10 px-4 text-label" confirm={{ title: "Show as coming soon?", body: course.status === "published" ? "The course stays visible but enrolment closes. Students already enrolled can't open the lessons until you publish it again." : "Visitors will see the course, its outline and its price (if set), marked Coming soon. Nobody can enrol or pay until you publish it.", label: "Set coming soon" }}>Set as coming soon</ActionButton>}
          {(course.status === "published" || course.status === "coming_soon") && <ActionButton action={setCourseStatus} fields={f("draft")} variant="outline" className="h-10 px-4 text-label" confirm={{ title: "Move this course to draft?", body: "It will disappear from the Academy. Existing enrolments and progress are kept.", label: "Move to draft" }}>{course.status === "published" ? "Unpublish" : "Hide (draft)"}</ActionButton>}
          {course.status !== "archived" && <ActionButton action={setCourseStatus} fields={f("archived")} variant="danger" className="h-10 px-4 text-label" confirm={{ title: "Archive this course?", body: "It will be hidden from the Academy and from students. You can restore it to draft later.", label: "Archive" }}>Archive</ActionButton>}
          {course.status === "archived" && <ActionButton action={setCourseStatus} fields={f("draft")} variant="outline" className="h-10 px-4 text-label" confirm={{ title: "Restore to draft?", body: "The course becomes a draft again. It stays hidden until you publish it.", label: "Restore" }}>Restore to draft</ActionButton>}
        </div>
        {(course.status === "coming_soon" || course.status === "draft") && (
          <div className="mt-6 max-w-xl border-t border-line pt-5">
            <AdminForm action={saveLaunchNote} submitLabel="Save launch note" stickyBar={false}>
              <input type="hidden" name="courseId" value={course.id} />
              <TextInput label="Launch note (optional)" name="launch_note" defaultValue={course.launch_note ?? ""} maxLength={80} placeholder="Opens January 2027" hint="Shown next to “Coming soon” on the course. Only promise a date you're sure of." />
            </AdminForm>
          </div>
        )}
      </Panel>

      <Panel title="Before you publish">
        <ul className="space-y-2.5">
          {checks.map((c) => (
            <li key={c.label} className="flex items-center gap-3 text-body-sm">
              {c.ok ? <Check aria-hidden className="h-4 w-4 text-blue" strokeWidth={2} /> : <Minus aria-hidden className="h-4 w-4 text-ink-3" strokeWidth={2} />}
              <span className={c.ok ? "text-ink" : "text-ink-2"}>{c.label}{!c.ok && c.required && <span className="ml-2 text-caption text-warm">Required</span>}{!c.ok && !c.required && <span className="ml-2 text-caption text-ink-3">Recommended</span>}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Certificates" description="When a student completes 100% of the published lessons, a certificate with a public verification link is issued automatically. The course page shows “Certificate included” while this is on.">
        <ActionButton action={setCertificates} fields={{ courseId: course.id, enabled: course.certificate_enabled ? "no" : "yes" }} variant="outline" className="h-10 px-4 text-label">
          {course.certificate_enabled ? "Certificates are on. Turn off" : "Certificates are off. Turn on"}
        </ActionButton>
        <a href="/admin/certificates/preview" target="_blank" rel="noopener" className="ml-3 text-body-sm text-blue underline-offset-4 hover:underline">Preview the certificate design</a>
        {course.certificate_enabled && (
          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-2 text-body-sm text-ink-2">{course.certificate_requires_quizzes ? "Students must also pass every published quiz in this course." : "Quizzes are optional for the certificate."}</p>
            <ActionButton action={setCertificateQuizRule} fields={{ courseId: course.id, required: course.certificate_requires_quizzes ? "no" : "yes" }} variant="outline" className="h-10 px-4 text-label">
              {course.certificate_requires_quizzes ? "Make quizzes optional" : "Require passing all quizzes"}
            </ActionButton>
          </div>
        )}
      </Panel>
    </div>
  );
}
