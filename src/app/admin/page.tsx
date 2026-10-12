import Link from "next/link";
import { TicketPercent, Briefcase, CreditCard, FolderOpen, PlayCircle, Plus, Sparkles, Users } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminEmpty, AdminError } from "@/components/admin/AdminStates";
import { getAdminContext } from "@/lib/admin/guard";
import type { Permission } from "@/lib/admin/roles";
import { formatDate, formatMoneyMinor } from "@/lib/admin/validation";

export const metadata = { title: "Dashboard" };

type Person = { first_name: string; last_name: string; email: string | null } | null;
const name = (p: Person) => (p ? `${p.first_name} ${p.last_name}`.trim() || p.email || "Student" : "Deleted user");

type Stats = {
  students: number; active_enrolments: number; published_courses: number; draft_courses: number; lessons: number; quiz_attempts: number;
  revenue: Record<string, number> | null; active_students?: number; completed_enrolments?: number; total_courses?: number; certificates?: number;
};

export default async function AdminDashboard() {
  const ctx = (await getAdminContext())!;
  const sb = ctx.supabase;

  const head = (t: string) => sb.from(t).select("id", { count: "exact", head: true });
  const [stats, enrols, pays, courses, enrolAll, progressAll, lessonAct, quizAct, pPub, pDraft, pPlaceholder, svcPub, msgNew, sections, recentLog, newStudents] = await Promise.all([
    sb.rpc("admin_dashboard_stats"),
    sb.from("enrolments").select("id, status, granted_at, courses(title), profiles(first_name, last_name, email)").order("granted_at", { ascending: false }).limit(6),
    sb.from("payments").select("id, reference, amount_minor, currency, status, created_at, courses(title), profiles(first_name, last_name, email)").order("created_at", { ascending: false }).limit(5),
    sb.from("courses").select("id, title, status").order("created_at", { ascending: false }).limit(12),
    sb.from("enrolments").select("course_id").in("status", ["active", "completed"]).limit(2000),
    sb.from("course_progress").select("course_id, percent").limit(2000),
    sb.from("lesson_progress").select("completed_at, profiles(first_name, last_name, email), lessons(title)").eq("completed", true).order("completed_at", { ascending: false }).limit(6),
    sb.from("quiz_attempts").select("submitted_at, percent, passed, profiles(first_name, last_name, email), quizzes(title)").order("submitted_at", { ascending: false }).limit(6),
    head("portfolio_projects").eq("status", "published").eq("is_placeholder", false),
    head("portfolio_projects").eq("status", "draft"),
    head("portfolio_projects").eq("status", "published").eq("is_placeholder", true),
    head("services").eq("status", "published"),
    head("contact_messages").eq("status", "new"),
    sb.from("page_sections").select("status"),
    sb.from("activity_logs").select("id, action, resource_label, actor_email, created_at").order("created_at", { ascending: false }).limit(8),
    sb.from("profiles").select("id, first_name, last_name, email, created_at").order("created_at", { ascending: false }).limit(5),
  ]);
  const websiteReady = !pPub.error;
  const sectionRows = (sections.data ?? []) as { status: string }[];
  const sectionsLive = sectionRows.filter((r) => r.status === "published").length;

  const header = <PageHeader eyebrow="Control room" title="Dashboard" subtitle="Your website and Fola Academy at a glance. Every number here comes from the database." actions={ctx.can("academy") ? <Link href="/admin/courses/new" className="inline-flex h-10 items-center gap-2 rounded bg-ink px-4 text-label text-canvas hover:bg-ink/90"><Plus aria-hidden className="h-4 w-4" />New course</Link> : undefined} />;

  if (stats.error || !stats.data) {
    // Server-side only (shows in the terminal running `npm run dev`). The on-screen message is unchanged.
    console.error("[admin dashboard] admin_dashboard_stats failed:", stats.error?.code, stats.error?.message);
    return <>{header}<AdminError body="The dashboard needs the Academy database setup. Run supabase/migrations/0002_admin_cms.sql in the Supabase SQL editor, then refresh." /></>;
  }
  const s = stats.data as Stats;
  const revenue = Object.entries(s.revenue ?? {});

  // Course performance
  const enrolCount = new Map<string, number>();
  (enrolAll.data ?? []).forEach((e) => enrolCount.set(e.course_id as string, (enrolCount.get(e.course_id as string) ?? 0) + 1));
  const pct = new Map<string, number[]>();
  (progressAll.data ?? []).forEach((p) => pct.set(p.course_id as string, [...(pct.get(p.course_id as string) ?? []), Number(p.percent)]));

  type Act = { at: string; text: string };
  const activity: Act[] = [
    ...((lessonAct.data ?? []) as unknown as { completed_at: string; profiles: Person; lessons: { title: string } | null }[]).map((a) => ({ at: a.completed_at, text: `${name(a.profiles)} completed “${a.lessons?.title ?? "a lesson"}”` })),
    ...((quizAct.data ?? []) as unknown as { submitted_at: string; percent: number; passed: boolean; profiles: Person; quizzes: { title: string } | null }[]).map((a) => ({ at: a.submitted_at, text: `${name(a.profiles)} scored ${a.percent}% on “${a.quizzes?.title ?? "a quiz"}” (${a.passed ? "passed" : "not passed"})` })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 8);

  type E = { id: string; status: string; granted_at: string; courses: { title: string } | null; profiles: Person };
  type P = { id: string; reference: string; amount_minor: number; currency: string; status: string; created_at: string; courses: { title: string } | null; profiles: Person };
  const enrolRows = (enrols.data ?? []) as unknown as E[];
  const payRows = (pays.data ?? []) as unknown as P[];

  const quick = [
    { href: "/admin/website/portfolio/new", label: "New portfolio project", icon: FolderOpen, perm: "website" },
    { href: "/admin/website/services/new", label: "New service", icon: Briefcase, perm: "website" },
    { href: "/admin/courses/new", label: "New course", icon: Plus, perm: "academy" },
    { href: "/admin/courses", label: "New lesson (choose a course)", icon: PlayCircle, perm: "academy" },
    { href: "/admin/ai/quiz-generator", label: "Generate quiz", icon: Sparkles, perm: "ai" },
    { href: "/admin/coupons/new", label: "New coupon", icon: TicketPercent, perm: "coupons" },
    { href: "/admin/students", label: "View students", icon: Users, perm: "students" },
    { href: "/admin/payments", label: "Review payments", icon: CreditCard, perm: "payments" },
  ].filter((q) => ctx.can(q.perm as Permission));
  type Log = { id: string; action: string; resource_label: string | null; actor_email: string | null; created_at: string };
  const logRows = (recentLog.data ?? []) as Log[];
  const studentRows = (newStudents.data ?? []) as { id: string; first_name: string; last_name: string; email: string | null; created_at: string }[];

  return (
    <>
      {header}
      {ctx.can("website") && <h2 className="mb-3 text-admin-section">Website</h2>}
      {!ctx.can("website") ? null : websiteReady ? (
        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
          <StatCard label="Published projects" value={pPub.count ?? 0} hint={pPlaceholder.count ? `+ ${pPlaceholder.count} placeholder${pPlaceholder.count === 1 ? "" : "s"} to replace` : undefined} href="/admin/website/portfolio" />
          <StatCard label="Draft projects" value={pDraft.count ?? 0} href="/admin/website/portfolio?status=draft" />
          <StatCard label="Published services" value={svcPub.count ?? 0} href="/admin/website/services" />
          <StatCard label="New messages" value={msgNew.count ?? 0} href="/admin/website/messages" />
          <StatCard label="Page sections live" value={`${sectionsLive} / ${sectionRows.length}`} hint="Homepage, About, Services, Contact" href="/admin/website/homepage" />
        </div>
      ) : (
        <div className="mb-8"><AdminError title="Website CMS isn't set up yet" body="Run supabase/migrations/0003_website_cms.sql in the Supabase SQL editor to manage the website from here." /></div>
      )}
      <h2 className="mb-3 text-admin-section">Academy</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Students" value={s.students} hint={s.active_students != null ? `${s.active_students} active in 30 days` : undefined} href="/admin/students" />
        <StatCard label="Active enrolments" value={s.active_enrolments} hint={s.completed_enrolments != null ? `${s.completed_enrolments} completed` : undefined} href="/admin/enrolments" />
        <StatCard label="Courses" value={s.total_courses ?? s.published_courses} hint={`${s.published_courses} published · ${s.draft_courses} draft`} href="/admin/courses" />
        <StatCard label="Quiz attempts" value={s.quiz_attempts} href="/admin/quizzes" />
        <StatCard label="Certificates issued" value={s.certificates ?? 0} href="/admin/certificates" />
        {ctx.can("payments") && <StatCard label="Revenue" value={revenue.length ? formatMoneyMinor(revenue[0][1], revenue[0][0]) : "0"} hint={revenue.length > 1 ? revenue.slice(1).map(([c, v]) => formatMoneyMinor(v, c)).join(" · ") : revenue.length ? undefined : "No successful payments yet"} href="/admin/payments" />}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Recent enrolments" actions={<Link href="/admin/enrolments" className="text-caption font-semibold text-ink-2 hover:text-ink">View all</Link>}>
            {enrolRows.length === 0 ? <AdminEmpty title="No enrolments yet" body="When a student enrols, or you enrol someone, it appears here." action={{ href: "/admin/enrolments", label: "Enrol a student" }} /> : (
              <ul className="divide-y divide-line">
                {enrolRows.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0"><p className="truncate text-body-sm font-medium">{name(e.profiles)}</p><p className="truncate text-caption text-ink-3">{e.courses?.title ?? "Deleted course"} · {formatDate(e.granted_at)}</p></div>
                    <StatusBadge status={e.status} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Course performance" description="Enrolments and average progress">
            {(courses.data ?? []).length === 0 ? <AdminEmpty title="No courses yet" body="Create your first course to start building your Academy." action={{ href: "/admin/courses/new", label: "Create course" }} /> : (
              <ul className="divide-y divide-line">
                {(courses.data ?? []).map((c) => {
                  const arr = pct.get(c.id as string) ?? [];
                  const avg = arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
                  return (
                    <li key={c.id as string} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[1fr_6rem_9rem]">
                      <div className="min-w-0"><Link href={`/admin/courses/${c.id}`} className="block truncate text-body-sm font-medium hover:underline">{c.title as string}</Link><div className="mt-1"><StatusBadge status={c.status as string} /></div></div>
                      <p className="text-right text-body-sm tabular-nums text-ink-2 sm:text-left">{enrolCount.get(c.id as string) ?? 0} enrolled</p>
                      <div className="col-span-2 sm:col-span-1" aria-label={`Average progress ${avg}%`}>
                        <div className="h-1 overflow-hidden rounded-full bg-line"><div className="thread-solid h-full" style={{ width: `${avg}%` }} /></div>
                        <p className="mt-1 text-caption text-ink-3">{avg}% avg progress</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Quick actions">
            <ul className="space-y-1">
              {quick.map((q) => (
                <li key={q.href + q.label}><Link href={q.href} className="flex h-10 items-center gap-3 rounded px-2 text-body-sm font-medium text-ink-2 transition-colors hover:bg-surface hover:text-ink"><q.icon aria-hidden className="h-4 w-4 text-blue" strokeWidth={1.5} />{q.label}</Link></li>
              ))}
            </ul>
          </Panel>

          {ctx.can("payments") && <Panel title="Recent payments" actions={<Link href="/admin/payments" className="text-caption font-semibold text-ink-2 hover:text-ink">View all</Link>}>
            {payRows.length === 0 ? <p className="text-body-sm text-ink-3">No payments yet.</p> : (
              <ul className="divide-y divide-line">
                {payRows.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0"><p className="truncate text-body-sm font-medium">{name(p.profiles)}</p><p className="truncate text-caption text-ink-3">{p.courses?.title ?? "—"} · {formatDate(p.created_at)}</p></div>
                    <div className="text-right"><p className="text-body-sm font-semibold tabular-nums">{formatMoneyMinor(p.amount_minor, p.currency)}</p><StatusBadge status={p.status} /></div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>}

          <Panel title="New students">
            {studentRows.length === 0 ? <p className="text-body-sm text-ink-3">New registrations appear here.</p> : (
              <ul className="space-y-3">{studentRows.map((p) => <li key={p.id} className="text-body-sm"><Link href={`/admin/students/${p.id}`} className="font-medium hover:underline">{name(p)}</Link><p className="text-caption text-ink-3">{formatDate(p.created_at)}</p></li>)}</ul>
            )}
          </Panel>

          {ctx.can("activity") && <Panel title="Recent activity log" actions={<Link href="/admin/activity" className="text-caption font-semibold text-ink-2 hover:text-ink">View all</Link>}>
            {logRows.length === 0 ? <p className="text-body-sm text-ink-3">Changes made in Admin are listed here.</p> : (
              <ul className="space-y-3">{logRows.map((l) => <li key={l.id} className="text-body-sm"><p><span className="first-letter:uppercase">{l.action}</span>{l.resource_label ? `: ${l.resource_label}` : ""}</p><p className="text-caption text-ink-3">{formatDate(l.created_at, true)}{l.actor_email ? ` · ${l.actor_email}` : " · system"}</p></li>)}</ul>
            )}
          </Panel>}

          <Panel title="Learning activity">
            {activity.length === 0 ? <p className="text-body-sm text-ink-3">Lesson completions and quiz attempts will show up here.</p> : (
              <ul className="space-y-3">
                {activity.map((a, i) => <li key={i} className="text-body-sm"><p>{a.text}</p><p className="text-caption text-ink-3">{formatDate(a.at, true)}</p></li>)}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
