import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ActionButton } from "@/components/admin/ActionButton";
import { setEnrolmentStatus } from "@/app/admin/actions/people";
import { getAdminContext } from "@/lib/admin/guard";
import { formatDate, formatMoneyMinor, isUuid } from "@/lib/admin/validation";

export const metadata = { title: "Student" };

export default async function StudentPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  if (!isUuid(studentId)) notFound();
  const { supabase } = (await getAdminContext())!;
  const [p, en, pr, qa, pay, ce] = await Promise.all([
    supabase.from("profiles").select("id, first_name, last_name, email, created_at, last_active_at").eq("id", studentId).maybeSingle(),
    supabase.from("enrolments").select("id, status, granted_at, source, courses(id, title)").eq("user_id", studentId).order("granted_at", { ascending: false }),
    supabase.from("course_progress").select("course_id, percent, completed_lessons, total_lessons").eq("user_id", studentId),
    supabase.from("quiz_attempts").select("id, percent, passed, submitted_at, quizzes(title)").eq("user_id", studentId).order("submitted_at", { ascending: false }).limit(10),
    supabase.from("payments").select("id, reference, amount_minor, currency, status, created_at, courses(title)").eq("user_id", studentId).order("created_at", { ascending: false }).limit(10),
    supabase.from("certificates").select("id, certificate_number, issued_at, revoked, courses(title)").eq("user_id", studentId),
  ]);
  if (!p.data) notFound();
  const s = p.data as { first_name: string; last_name: string; email: string | null; created_at: string; last_active_at: string | null };
  type Prog = { percent: number; completed_lessons: number; total_lessons: number };
  const progress = new Map<string, Prog>((pr.data ?? []).map((x) => [x.course_id as string, x as unknown as Prog] as [string, Prog]));
  type En = { id: string; status: string; granted_at: string; source: string; courses: { id: string; title: string } | null };
  const none = <p className="text-body-sm text-ink-3">Nothing yet.</p>;

  return (
    <>
      <PageHeader eyebrow="Student" title={`${s.first_name} ${s.last_name}`.trim() || "Unnamed student"} subtitle={<><Link href="/admin/students" className="underline underline-offset-4">All students</Link> · {s.email}</>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Profile">
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-body-sm"><dt className="text-ink-3">Email</dt><dd>{s.email ?? "–"}</dd><dt className="text-ink-3">Joined</dt><dd>{formatDate(s.created_at)}</dd><dt className="text-ink-3">Last active</dt><dd>{formatDate(s.last_active_at, true)}</dd></dl>
        </Panel>
        <Panel title="Certificates">
          {(ce.data ?? []).length === 0 ? none : <ul className="space-y-2 text-body-sm">{(ce.data ?? []).map((c) => <li key={c.id as string} className="flex items-center justify-between gap-3"><span>{(c.courses as unknown as { title: string } | null)?.title}<span className="block text-caption text-ink-3">{c.certificate_number as string} · {formatDate(c.issued_at as string)}</span></span><StatusBadge status={c.revoked ? "revoked" : "valid"} /></li>)}</ul>}
        </Panel>
        <Panel title="Enrolments and progress" className="lg:col-span-2">
          {(en.data ?? []).length === 0 ? none : (
            <ul className="divide-y divide-line">
              {((en.data ?? []) as unknown as En[]).map((e) => {
                const pg = e.courses ? progress.get(e.courses.id) : undefined;
                return (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0"><p className="text-body-sm font-medium">{e.courses?.title ?? "Deleted course"}</p><p className="text-caption text-ink-3">Enrolled {formatDate(e.granted_at)} · {e.source}{pg ? ` · ${pg.completed_lessons}/${pg.total_lessons} lessons (${pg.percent}%)` : ""}</p></div>
                    <div className="flex items-center gap-2"><StatusBadge status={e.status} />
                      {e.status !== "cancelled" && <ActionButton action={setEnrolmentStatus} fields={{ enrolmentId: e.id, to: "cancelled" }} variant="danger" confirm={{ title: "Cancel this enrolment?", body: "The student loses access to the course. Their progress is kept.", label: "Cancel enrolment" }}>Cancel</ActionButton>}
                      {e.status === "cancelled" && <ActionButton action={setEnrolmentStatus} fields={{ enrolmentId: e.id, to: "active" }} variant="outline" confirm={{ title: "Reactivate this enrolment?", body: "The student regains access to the course.", label: "Reactivate" }}>Reactivate</ActionButton>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
        <Panel title="Quiz attempts">
          {(qa.data ?? []).length === 0 ? none : <ul className="space-y-2 text-body-sm">{(qa.data ?? []).map((a) => <li key={a.id as string} className="flex items-center justify-between gap-3"><span>{(a.quizzes as unknown as { title: string } | null)?.title}<span className="block text-caption text-ink-3">{formatDate(a.submitted_at as string, true)}</span></span><span className="tabular-nums">{a.percent as number}% <StatusBadge status={a.passed ? "passed" : "not_passed"} /></span></li>)}</ul>}
        </Panel>
        <Panel title="Payments">
          {(pay.data ?? []).length === 0 ? none : <ul className="space-y-2 text-body-sm">{(pay.data ?? []).map((x) => <li key={x.id as string} className="flex items-center justify-between gap-3"><span>{(x.courses as unknown as { title: string } | null)?.title ?? "–"}<span className="block text-caption text-ink-3">{x.reference as string} · {formatDate(x.created_at as string)}</span></span><span className="tabular-nums">{formatMoneyMinor(x.amount_minor as number, x.currency as string)} <StatusBadge status={x.status as string} /></span></li>)}</ul>}
        </Panel>
      </div>
    </>
  );
}
