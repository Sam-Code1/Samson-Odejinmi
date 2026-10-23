import Link from "next/link";
import { Award, BookOpen, Briefcase, CheckCircle2, ClipboardCheck, CreditCard, FolderOpen, GraduationCap, Inbox, LayoutTemplate, PlayCircle, Plus, Sparkles, TicketPercent, UserPlus, Users, Wallet } from "lucide-react";
import { PageHeader, Panel } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminEmpty, AdminError } from "@/components/admin/AdminStates";
import { PeriodFilter } from "@/components/admin/PeriodFilter";
import { TrendChart } from "@/components/admin/charts/TrendChart";
import { BarList } from "@/components/admin/charts/BarList";
import { Delta } from "@/components/admin/charts/Delta";
import { fmt } from "@/components/admin/charts/format";
import { getAdminContext } from "@/lib/admin/guard";
import type { Permission } from "@/lib/admin/roles";
import { PERIODS, periodDays } from "@/lib/admin/marketing-stats";
import { getDashboardSeries } from "@/lib/admin/timeseries";
import { first, formatDate, formatMoneyMinor } from "@/lib/admin/validation";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

type Person = { first_name: string; last_name: string; email: string | null } | null;
const name = (p: Person) => (p ? `${p.first_name} ${p.last_name}`.trim() || p.email || "Student" : "Deleted user");

type Stats = {
  students: number; active_enrolments: number; published_courses: number; draft_courses: number; lessons: number; quiz_attempts: number;
  revenue: Record<string, number> | null; active_students?: number; completed_enrolments?: number; total_courses?: number; certificates?: number;
};

const TZ = "Africa/Lagos";
function greeting() {
  const h = Number(new Date().toLocaleString("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TZ }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/**
 * The control room: this period vs the one before it, for money, people and learning; then what needs attention.
 * Every number comes from stored rows (RLS: admins only). The period is ?days=7|30|90|365; revenue currency ?cur=.
 */
export default async function AdminDashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const ctx = (await getAdminContext())!;
  const sb = ctx.supabase;
  const sp = await searchParams;
  const days = periodDays(first(sp.days));
  const period = PERIODS[String(days) as keyof typeof PERIODS].toLowerCase();

  const head = (t: string) => sb.from(t).select("id", { count: "exact", head: true });
  const [stats, series, me, pays, courses, enrolAll, progressAll, lessonAct, quizAct, pPub, pDraft, svcPub, msgNew, sections, newStudents, soon] = await Promise.all([
    sb.rpc("admin_dashboard_stats"),
    getDashboardSeries(ctx, days),
    sb.from("profiles").select("first_name").eq("id", ctx.user.id).maybeSingle(),
    sb.from("payments").select("id, reference, amount_minor, currency, status, created_at, courses(title), profiles(first_name, last_name, email)").order("created_at", { ascending: false }).limit(6),
    sb.from("courses").select("id, title, status").neq("status", "archived").order("created_at", { ascending: false }).limit(12),
    sb.from("enrolments").select("course_id").in("status", ["active", "completed"]).limit(5000),
    sb.from("course_progress").select("course_id, percent").limit(5000),
    sb.from("lesson_progress").select("completed_at, profiles(first_name, last_name, email), lessons(title)").eq("completed", true).order("completed_at", { ascending: false }).limit(6),
    sb.from("quiz_attempts").select("submitted_at, percent, passed, profiles(first_name, last_name, email), quizzes(title)").order("submitted_at", { ascending: false }).limit(6),
    head("portfolio_projects").eq("status", "published").eq("is_placeholder", false),
    head("portfolio_projects").eq("status", "draft"),
    head("services").eq("status", "published"),
    head("contact_messages").eq("status", "new"),
    sb.from("page_sections").select("status"),
    sb.from("profiles").select("id, first_name, last_name, email, created_at").order("created_at", { ascending: false }).limit(5),
    head("courses").eq("status", "coming_soon"),
  ]);

  const rawFirst = (me.data as { first_name?: string } | null)?.first_name?.trim();
  // Names saved in capitals ("SAMSON") read as shouting in a greeting: show them as "Samson".
  const firstName = rawFirst && rawFirst === rawFirst.toUpperCase() ? rawFirst.charAt(0) + rawFirst.slice(1).toLowerCase() : rawFirst;
  const header = (
    <PageHeader eyebrow={new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: TZ })}
      title={`${greeting()}${firstName ? `, ${firstName}` : ""}.`}
      subtitle={`How the website and Fola Academy are doing over the ${period}, compared with the ${days === 365 ? "year" : `${days} days`} before.`}
      actions={<>
        <PeriodFilter current={days} basePath="/admin" />
        {ctx.can("academy") && <Link href="/admin/courses/new" className="inline-flex h-10 items-center gap-2 rounded-lg bg-action px-4 text-label text-on-action hover:bg-action-hover"><Plus aria-hidden className="h-4 w-4" />New course</Link>}
      </>} />
  );

  if (stats.error || !stats.data) {
    console.error("[admin dashboard] admin_dashboard_stats failed:", stats.error?.code, stats.error?.message);
    return <>{header}<AdminError body="The dashboard needs the Academy database setup. Run supabase/migrations/0002_admin_cms.sql in the Supabase SQL editor, then refresh." /></>;
  }
  const s = stats.data as Stats;
  const canPay = ctx.can("payments");
  const cur = typeof sp.cur === "string" && series.currencies.includes(sp.cur) ? sp.cur : series.currencies[0];
  const rev = series.revenue[cur];
  const money = `money:${cur}` as const;

  // Course performance
  const enrolCount = new Map<string, number>();
  (enrolAll.data ?? []).forEach((e) => enrolCount.set(e.course_id as string, (enrolCount.get(e.course_id as string) ?? 0) + 1));
  const pct = new Map<string, number[]>();
  (progressAll.data ?? []).forEach((p) => pct.set(p.course_id as string, [...(pct.get(p.course_id as string) ?? []), Number(p.percent)]));
  const courseRows = ((courses.data ?? []) as { id: string; title: string; status: string }[]).map((c) => {
    const arr = pct.get(c.id) ?? [];
    const avg = arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    const n = enrolCount.get(c.id) ?? 0;
    return { key: c.id, label: c.title, value: n, display: `${n} enrolled`, hint: `${avg}% avg progress`, href: `/admin/courses/${c.id}` };
  });

  type Act = { at: string; who: string; text: string; kind: "lesson" | "quiz-pass" | "quiz-fail" };
  const activity: Act[] = [
    ...((lessonAct.data ?? []) as unknown as { completed_at: string; profiles: Person; lessons: { title: string } | null }[]).map((a) => ({ at: a.completed_at, who: name(a.profiles), text: `completed “${a.lessons?.title ?? "a lesson"}”`, kind: "lesson" as const })),
    ...((quizAct.data ?? []) as unknown as { submitted_at: string; percent: number; passed: boolean; profiles: Person; quizzes: { title: string } | null }[]).map((a) => ({ at: a.submitted_at, who: name(a.profiles), text: `scored ${a.percent}% on “${a.quizzes?.title ?? "a quiz"}”`, kind: a.passed ? "quiz-pass" as const : "quiz-fail" as const })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 7);

  type P = { id: string; reference: string; amount_minor: number; currency: string; status: string; created_at: string; courses: { title: string } | null; profiles: Person };
  const payRows = (pays.data ?? []) as unknown as P[];
  const studentRows = (newStudents.data ?? []) as { id: string; first_name: string; last_name: string; email: string | null; created_at: string }[];
  const sectionRows = (sections.data ?? []) as { status: string }[];
  const finished = s.completed_enrolments ?? 0, inProgress = s.active_enrolments;
  const completion = finished + inProgress ? Math.round((finished / (finished + inProgress)) * 100) : 0;

  const quick = [
    { href: "/admin/website/portfolio", label: "Add a project", icon: FolderOpen, perm: "website" },
    { href: "/admin/website/gallery", label: "Upload work", icon: LayoutTemplate, perm: "website" },
    { href: "/admin/courses/new", label: "New course", icon: BookOpen, perm: "academy" },
    { href: "/admin/courses", label: "Add a lesson", icon: PlayCircle, perm: "academy" },
    { href: "/admin/ai/quiz-generator", label: "Generate a quiz", icon: Sparkles, perm: "ai" },
    { href: "/admin/coupons/new", label: "New coupon", icon: TicketPercent, perm: "coupons" },
    { href: "/admin/certificates", label: "Certificates", icon: Award, perm: "certificates" },
    { href: "/admin/payments", label: "Payments", icon: CreditCard, perm: "payments" },
  ].filter((q) => ctx.can(q.perm as Permission));

  return (
    <>
      {header}
      {series.failed && <div className="mb-6"><AdminError title="Some trends couldn't load" body="The totals below are still correct. Refresh to try again." /></div>}

      {/* KPIs: this period, change vs the previous one, and the shape of it. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {canPay && rev
          ? <StatCard label={`Revenue · ${cur}`} value={fmt(rev.total, money)} icon={Wallet} delta={{ cur: rev.total, prev: rev.prevTotal }} spark={rev.spark} hint={`${series.orders.total} paid order${series.orders.total === 1 ? "" : "s"}`} href="/admin/payments" />
          : <StatCard label="Certificates issued" value={s.certificates ?? 0} icon={Award} hint="All time" href="/admin/certificates" />}
        <StatCard label="New students" value={series.signups.total} icon={UserPlus} delta={{ cur: series.signups.total, prev: series.signups.prevTotal }} spark={series.signups.spark} slot={3} hint={`${s.students.toLocaleString("en")} in total`} href="/admin/students" />
        <StatCard label="Enrolments" value={series.enrolments.total} icon={GraduationCap} delta={{ cur: series.enrolments.total, prev: series.enrolments.prevTotal }} spark={series.enrolments.spark} slot={4} hint={`${s.active_enrolments} active now`} href="/admin/enrolments" />
        <StatCard label="Lessons completed" value={series.lessons.total} icon={CheckCircle2} delta={{ cur: series.lessons.total, prev: series.lessons.prevTotal }} spark={series.lessons.spark} slot={2} hint={s.active_students != null ? `${s.active_students} active learners (30 days)` : undefined} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-12">
        {canPay && rev ? (
          <Panel className="xl:col-span-8" title="Revenue" description={`Paid orders in ${cur}, ${period}. The grey line is the period before.`}
            actions={series.currencies.length > 1 ? (
              <nav aria-label="Currency" className="inline-flex rounded-lg border border-line bg-surface/60 p-0.5">
                {series.currencies.map((c) => <Link key={c} href={`/admin?days=${days}&cur=${c}`} aria-current={c === cur ? "true" : undefined} className={cn("rounded-md px-2.5 py-1 text-[0.78rem] font-semibold", c === cur ? "bg-elevated text-ink shadow-[var(--ad-shadow)]" : "text-ink-3 hover:text-ink")}>{c}</Link>)}
              </nav>
            ) : undefined}>
            <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-[2rem] font-semibold leading-none tracking-[-0.03em]">{fmt(rev.total, money)}</p>
              <Delta cur={rev.total} prev={rev.prevTotal} />
              <p className="text-caption text-ink-3">vs {fmt(rev.prevTotal, money)} before</p>
            </div>
            <TrendChart points={rev.points} format={money} label={`Revenue (${cur})`} height={260} />
          </Panel>
        ) : (
          <Panel className="xl:col-span-8" title="New students" description={`Sign-ups, ${period}. The grey line is the period before.`}>
            <TrendChart points={series.signups.points} label="New students" slot={3} height={260} />
          </Panel>
        )}

        <Panel className="xl:col-span-4" title="Academy at a glance">
          <div className="flex items-center gap-5 rounded-xl bg-surface/60 p-4">
            <Ring value={completion} />
            <div className="min-w-0">
              <p className="text-[0.8125rem] font-medium text-ink-2">Completion rate</p>
              <p className="mt-1 text-caption text-ink-3">{finished.toLocaleString("en")} finished · {inProgress.toLocaleString("en")} still learning</p>
            </div>
          </div>
          <dl className="mt-4 divide-y divide-line">
            {[
              { icon: Users, label: "Students", value: s.students, href: "/admin/students" },
              { icon: BookOpen, label: "Courses", value: s.total_courses ?? s.published_courses, sub: `${s.published_courses} live · ${soon.count ?? 0} soon · ${s.draft_courses} draft`, href: "/admin/courses" },
              { icon: ClipboardCheck, label: "Quiz attempts", value: s.quiz_attempts, href: "/admin/quizzes" },
              { icon: Award, label: "Certificates", value: s.certificates ?? 0, href: "/admin/certificates" },
            ].map((r) => (
              <div key={r.label} className="flex items-center gap-3 py-3 first:pt-1 last:pb-0">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface text-ink-2"><r.icon aria-hidden className="h-4 w-4" strokeWidth={1.6} /></span>
                <dt className="min-w-0 flex-1"><Link href={r.href} className="text-body-sm font-medium hover:underline">{r.label}</Link>{r.sub && <p className="truncate text-caption text-ink-3">{r.sub}</p>}</dt>
                <dd className="ad-num text-body font-semibold">{r.value.toLocaleString("en")}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel className="xl:col-span-7" title="Enrolments" description={`New enrolments, ${period}.`}>
          <TrendChart points={series.enrolments.points} kind="columns" label="Enrolments" slot={4} height={220} />
        </Panel>

        <Panel className="xl:col-span-5" title="Courses" description="Ranked by enrolments, with average progress." actions={<Link href="/admin/courses" className="text-caption font-semibold text-ink-2 hover:text-ink">All courses</Link>}>
          {courseRows.length === 0 ? <AdminEmpty title="No courses yet" body="Create your first course to start building your Academy." action={{ href: "/admin/courses/new", label: "Create course" }} />
            : <BarList rows={courseRows} slot={4} limit={6} />}
        </Panel>

        {canPay && (
          <Panel className="xl:col-span-7" title="Recent payments" actions={<Link href="/admin/payments" className="text-caption font-semibold text-ink-2 hover:text-ink">View all</Link>}>
            {payRows.length === 0 ? <p className="py-6 text-center text-body-sm text-ink-3">No payments yet.</p> : (
              <ul className="-my-1 divide-y divide-line">
                {payRows.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-3">
                    <Avatar label={name(p.profiles)} />
                    <div className="min-w-0 flex-1"><p className="truncate text-body-sm font-medium">{name(p.profiles)}</p><p className="truncate text-caption text-ink-3">{p.courses?.title ?? p.reference} · {formatDate(p.created_at)}</p></div>
                    <div className="shrink-0 text-right"><p className="ad-num text-body-sm font-semibold">{formatMoneyMinor(p.amount_minor, p.currency)}</p><StatusBadge status={p.status} className="mt-0.5" /></div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        <Panel className={canPay ? "xl:col-span-5" : "xl:col-span-12"} title="Learning activity" description="Lessons finished and quizzes taken, newest first.">
          {activity.length === 0 ? <p className="py-6 text-center text-body-sm text-ink-3">Lesson completions and quiz attempts will show up here.</p> : (
            <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-line">
              {activity.map((a, i) => (
                <li key={i} className="relative flex gap-3 pl-0">
                  <span aria-hidden className={cn("relative z-[1] mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border-[3px] border-elevated", a.kind === "lesson" ? "bg-[var(--c1)]" : a.kind === "quiz-pass" ? "bg-[var(--c4)]" : "bg-[var(--c2)]")} />
                  <div className="min-w-0 text-body-sm"><p><span className="font-semibold">{a.who}</span> <span className="text-ink-2">{a.text}</span>{a.kind === "quiz-fail" && <span className="text-ink-3"> (not passed)</span>}</p><p className="text-caption text-ink-3">{formatDate(a.at, true)}</p></div>
                </li>
              ))}
            </ol>
          )}
        </Panel>

        {ctx.can("website") && !pPub.error && (
          <Panel className="xl:col-span-7" title="Website" actions={<Link href="/" className="text-caption font-semibold text-ink-2 hover:text-ink">View site</Link>}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Live projects", value: pPub.count ?? 0, href: "/admin/website/portfolio", icon: FolderOpen },
                { label: "Draft projects", value: pDraft.count ?? 0, href: "/admin/website/portfolio?status=draft", icon: Briefcase },
                { label: "New messages", value: msgNew.count ?? 0, href: "/admin/website/messages", icon: Inbox, alert: (msgNew.count ?? 0) > 0 },
                { label: "Sections live", value: `${sectionRows.filter((r) => r.status === "published").length}/${sectionRows.length}`, href: "/admin/website/homepage", icon: LayoutTemplate },
              ].map((t) => (
                <Link key={t.label} href={t.href} className="group min-w-0 rounded-xl border border-line p-3.5 transition-colors hover:border-line-strong hover:bg-surface/50">
                  <span className="flex items-center justify-between"><t.icon aria-hidden className="h-4 w-4 text-ink-3" strokeWidth={1.6} />{t.alert && <span className="h-2 w-2 rounded-full bg-[var(--c2)]" aria-label="Needs attention" />}</span>
                  <p className="ad-num mt-3 text-[1.375rem] font-semibold leading-none">{t.value}</p>
                  <p className="mt-1.5 truncate text-caption text-ink-3">{t.label}</p>
                </Link>
              ))}
            </div>
            {svcPub.count != null && <p className="mt-4 text-caption text-ink-3">{svcPub.count} published service{svcPub.count === 1 ? "" : "s"}.</p>}
          </Panel>
        )}

        <Panel className={ctx.can("website") && !pPub.error ? "xl:col-span-5" : "xl:col-span-12"} title="Quick actions">
          <ul className="grid grid-cols-2 gap-2">
            {quick.map((q) => (
              <li key={q.href + q.label}>
                <Link href={q.href} className="flex h-full min-h-[3.25rem] items-center gap-2.5 rounded-xl border border-line px-3 py-2.5 text-[0.84rem] font-medium text-ink-2 transition-colors hover:border-line-strong hover:bg-surface/50 hover:text-ink">
                  <q.icon aria-hidden className="h-4 w-4 shrink-0 text-blue" strokeWidth={1.6} /><span className="min-w-0">{q.label}</span>
                </Link>
              </li>
            ))}
          </ul>
          {studentRows.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <p className="ad-label mb-3">Newest students</p>
              <ul className="flex flex-wrap gap-2">
                {studentRows.map((p) => (
                  <li key={p.id}><Link href={`/admin/students/${p.id}`} title={`${name(p)} · joined ${formatDate(p.created_at)}`} className="flex max-w-[11rem] items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3 text-caption hover:bg-surface/60"><Avatar label={name(p)} small /><span className="truncate">{name(p)}</span></Link></li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

/** A completion ring: the share as an arc, the number in text beside the ring's purpose. */
function Ring({ value }: { value: number }) {
  const r = 26, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative h-16 w-16 shrink-0" role="img" aria-label={`${v}% of enrolments completed`}>
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgb(var(--line) / var(--line-a))" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--c4)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} className="transition-[stroke-dasharray] duration-700" />
      </svg>
      <span className="ad-num absolute inset-0 grid place-items-center text-[0.9rem] font-semibold">{v}%</span>
    </div>
  );
}

function Avatar({ label, small }: { label: string; small?: boolean }) {
  const ini = label.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
  const hue = [...label].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 4 + 1;
  return <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-full font-semibold text-white", small ? "h-6 w-6 text-[0.6rem]" : "h-9 w-9 text-[0.72rem]")} style={{ background: `var(--c${hue})` }}>{ini}</span>;
}
