"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Receipt, Star, HeartPulse, ShieldAlert, ChartLine, Contact, Gauge, Handshake, Mail, Megaphone, MessageCircle, Package, Target, WandSparkles, Workflow, Bot, BookOpenCheck, ScrollText, ShieldCheck, TicketPercent, AtSign, Award, BookOpen, Briefcase, ClipboardList, Compass, CreditCard, FolderOpen, Globe, HelpCircle, History, Home, Image as ImageIcon, Inbox, Layers, LayoutDashboard, LogOut, Menu, ChevronDown, ChevronRight, Paperclip, PenLine, PlayCircle, Search, Settings, Share2, Sparkles, User, UserCheck, Users, X } from "lucide-react";
import { ThemeSwitcher } from "@/components/layout/ThemeSwitcher";
import { CommandPalette } from "@/components/app/CommandPalette";
import { NotificationBell } from "@/components/app/NotificationBell";
import { signOut } from "@/app/auth-actions";
import { ToastProvider } from "./Toast";
import { cn } from "@/lib/utils";
import { FMark } from "@/components/brand/Brand";
import { adminRoot } from "@/app/fonts";
import { can, ROLE_LABELS, type AdminRole, type Permission } from "@/lib/admin/roles";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; exact?: boolean; perm?: Permission };

const groups: { title: string; items: Item[] }[] = [
  { title: "Overview", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true }] },
  { title: "Website", items: [
    { href: "/admin/website/homepage", label: "Homepage", icon: Home, perm: "website" },
    { href: "/admin/website/about", label: "About", icon: User, perm: "website" },
    { href: "/admin/website/gallery", label: "Gallery", icon: ImageIcon, perm: "website" },
    { href: "/admin/website/portfolio", label: "Projects", icon: FolderOpen, perm: "website" },
    { href: "/admin/website/services", label: "Services", icon: Briefcase, perm: "website" },
    { href: "/admin/website/contact", label: "Contact", icon: AtSign, perm: "website" },
    { href: "/admin/website/messages", label: "Messages", icon: Inbox, perm: "website" },
    { href: "/admin/website/social", label: "Social links", icon: Share2, perm: "website" },
    { href: "/admin/website/seo", label: "SEO", icon: Search, perm: "website" },
  ] },
  { title: "Academy", items: [
    { href: "/admin/courses", label: "Courses", icon: BookOpen, perm: "academy" },
    { href: "/admin/modules", label: "Modules", icon: Layers, perm: "academy" },
    { href: "/admin/lessons", label: "Lessons", icon: PlayCircle, perm: "academy" },
    { href: "/admin/quizzes", label: "Quizzes", icon: ClipboardList, perm: "academy" },
    { href: "/admin/questions", label: "Question bank", icon: HelpCircle, perm: "academy" },
    { href: "/admin/resources", label: "Resources", icon: Paperclip, perm: "academy" },
  ] },
  { title: "People", items: [
    { href: "/admin/students", label: "Students", icon: Users, perm: "students" },
    { href: "/admin/enrolments", label: "Enrolments", icon: UserCheck, perm: "enrolments" },
    { href: "/admin/payments", label: "Payments", icon: CreditCard, perm: "payments" },
    { href: "/admin/certificates", label: "Certificates", icon: Award, perm: "certificates" },
  ] },
  { title: "Sales & marketing", items: [
    { href: "/admin/marketing", label: "Overview", icon: Gauge, exact: true, perm: "marketing" },
    { href: "/admin/products", label: "Products", icon: Package, perm: "products" },
    { href: "/admin/orders", label: "Orders", icon: Receipt, perm: "payments" },
    { href: "/admin/reviews", label: "Reviews", icon: Star, perm: "products" },
    { href: "/admin/marketing/campaigns", label: "Campaigns", icon: Megaphone, perm: "marketing" },
    { href: "/admin/marketing/email", label: "Email", icon: Mail, perm: "marketing" },
    { href: "/admin/marketing/automations", label: "Automations", icon: Workflow, perm: "marketing" },
    { href: "/admin/marketing/customers", label: "Customers", icon: Contact, perm: "customers" },
    { href: "/admin/marketing/affiliates", label: "Affiliates", icon: Handshake, perm: "affiliates" },
    { href: "/admin/coupons", label: "Coupons", icon: TicketPercent, perm: "coupons" },
    { href: "/admin/marketing/attribution", label: "Attribution", icon: Target, perm: "marketing" },
    { href: "/admin/marketing/analytics", label: "Analytics", icon: ChartLine, perm: "marketing" },
    { href: "/admin/marketing/assistant", label: "AI marketing assistant", icon: WandSparkles, perm: "marketing" },
    { href: "/admin/marketing/whatsapp", label: "WhatsApp", icon: MessageCircle, perm: "marketing" },
  ] },
  { title: "AI tools", items: [
    { href: "/admin/ai", label: "AI overview", icon: Bot, exact: true, perm: "ai" },
    { href: "/admin/ai/quiz-generator", label: "Quiz generator", icon: Sparkles, perm: "ai" },
    { href: "/admin/ai/lesson-assistant", label: "Lesson assistant", icon: BookOpenCheck, perm: "ai" },
    { href: "/admin/ai/content-assistant", label: "Content assistant", icon: PenLine, perm: "ai" },
    { href: "/admin/ai/logs", label: "AI request log", icon: ScrollText, perm: "ai" },
  ] },
  { title: "System", items: [
    { href: "/admin/media", label: "Media", icon: ImageIcon, perm: "media" },
    { href: "/admin/settings/site", label: "Site settings", icon: Globe, perm: "settings" },
    { href: "/admin/settings", label: "Academy settings", icon: Settings, exact: true, perm: "settings" },
    { href: "/admin/settings/payments", label: "Payment settings", icon: CreditCard, perm: "payments" },
    { href: "/admin/system/health", label: "System health", icon: HeartPulse, perm: "settings" },
    { href: "/admin/system/security", label: "Security", icon: ShieldAlert, perm: "activity" },
    { href: "/admin/admins", label: "Admins", icon: ShieldCheck, perm: "admins" },
    { href: "/admin/activity", label: "Activity log", icon: History, perm: "activity" },
  ] },
];

const OPEN_KEY = "fa-admin-nav-open";

/** Grouped navigation. Groups collapse (the one you're in always stays open); your choice is remembered. */
function NavLinks({ onNavigate, role }: { onNavigate?: () => void; role: AdminRole }) {
  const pathname = usePathname();
  const active = (i: Item) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(i.href + "/"));
  const visible = groups.map((g) => ({ ...g, items: g.items.filter((i) => !i.perm || can(role, i.perm)) })).filter((g) => g.items.length > 0);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  useEffect(() => { try { setOpen(JSON.parse(localStorage.getItem(OPEN_KEY) ?? "{}")); } catch { /* storage blocked */ } }, []);
  const toggle = (t: string, now: boolean) => setOpen((o) => {
    const next = { ...o, [t]: !now };
    try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
    return next;
  });
  const link = "ad-nav-link flex h-9 items-center gap-3 rounded-lg px-3 text-[0.875rem] font-medium transition-colors";
  return (
    <nav aria-label="Admin" className="flex-1 space-y-1 overflow-y-auto px-3 py-4 [scrollbar-width:thin]">
      {visible.map((g) => {
        const here = g.items.some(active);
        const isOpen = g.title === "Overview" || here || (open[g.title] ?? false);
        return (
          <div key={g.title} className="pb-1">
            {g.title === "Overview" ? null : (
              <button type="button" onClick={() => toggle(g.title, isOpen)} aria-expanded={isOpen} disabled={here}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left disabled:cursor-default">
                <span className="ad-label !text-[0.65rem]">{g.title}</span>
                {!here && <ChevronDown aria-hidden className={cn("h-3.5 w-3.5 text-ink-3 transition-transform", isOpen ? "rotate-0" : "-rotate-90")} />}
              </button>
            )}
            {isOpen && (
              <ul className="space-y-0.5">
                {g.items.map((i) => {
                  const on = active(i);
                  return (
                    <li key={i.href}>
                      <Link href={i.href} onClick={onNavigate} aria-current={on ? "page" : undefined} className={cn(link, on ? "" : "text-ink-2 hover:bg-surface hover:text-ink")}>
                        <i.icon aria-hidden className={cn("h-4 w-4 shrink-0", on ? "" : "text-ink-3")} strokeWidth={1.6} />
                        <span className="truncate">{i.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function initials(email?: string) {
  const local = (email ?? "A").split("@")[0].replace(/[^a-z0-9]+/gi, " ").trim();
  const parts = local.split(" ");
  return ((parts[0]?.[0] ?? "A") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Who's signed in, plus the ways out (Academy, website, profile, sign out). */
function AccountCard({ email, role, onNavigate }: { email?: string; role: AdminRole; onNavigate?: () => void }) {
  const item = "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[0.8125rem] font-medium text-ink-2 transition-colors hover:bg-surface hover:text-ink";
  return (
    <div className="shrink-0 border-t border-line p-3">
      <div className="mb-2 grid grid-cols-2 gap-1">
        <Link href="/academy" onClick={onNavigate} className={item}><Compass aria-hidden className="h-4 w-4 text-ink-3" strokeWidth={1.6} />Academy</Link>
        <Link href="/" onClick={onNavigate} className={item}><Globe aria-hidden className="h-4 w-4 text-ink-3" strokeWidth={1.6} />Website</Link>
      </div>
      <div className="flex items-center gap-3 rounded-xl bg-surface/70 p-2.5">
        <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,rgb(var(--path-start)),rgb(var(--path-end)))] text-[0.75rem] font-bold text-white">{initials(email)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.8125rem] font-semibold" title={email}>{email ?? "Admin"}</p>
          <p className="truncate text-[0.72rem] text-ink-3">{ROLE_LABELS[role]}</p>
        </div>
        <Link href="/profile" onClick={onNavigate} title="Profile" aria-label="Profile" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-elevated hover:text-ink"><User aria-hidden className="h-4 w-4" strokeWidth={1.6} /></Link>
        <form action={signOut}>
          <button type="submit" title="Sign out" aria-label="Sign out" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-elevated hover:text-ink"><LogOut aria-hidden className="h-4 w-4" strokeWidth={1.6} /></button>
        </form>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/admin" className="flex min-w-0 items-center gap-2.5">
      <FMark className="h-7 w-7" />
      <span className="truncate text-[1rem] tracking-tight"><span className="font-extrabold">Fola</span> <span className="font-medium">Academy</span></span>
      <span className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-ink-3">Admin</span>
    </Link>
  );
}

export function AdminShell({ email, role, children }: { email?: string; role: AdminRole; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); };
  }, [open]);
  const here = groups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.title })))
    .filter((i) => (i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(i.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <ToastProvider>
      <div className={adminRoot("min-h-dvh lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]")}>
        <aside className="ad-sidebar sticky top-0 hidden h-dvh flex-col border-r border-line lg:flex">
          <div className="flex h-16 shrink-0 items-center px-5"><Brand /></div>
          <NavLinks role={role} />
          <AccountCard email={email} role={role} />
        </aside>

        <div className="min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-xl sm:px-6 lg:h-16 lg:px-10">
            <div className="flex min-w-0 items-center gap-2">
              <button ref={btn} type="button" onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open} aria-controls="admin-drawer" className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg lg:hidden">
                <Menu aria-hidden className="h-5 w-5" strokeWidth={1.6} />
              </button>
              <span className="lg:hidden"><FMark className="h-6 w-6" /></span>
              {here && (
                <p className="hidden min-w-0 items-center gap-1.5 text-[0.8125rem] sm:flex">
                  <span className="text-ink-3">{here.group === "Overview" ? "Admin" : here.group}</span>
                  <ChevronRight aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink-3" />
                  <span className="truncate font-semibold">{here.label}</span>
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <CommandPalette placeholder="Search students, products, payments, messages…" />
              <NotificationBell />
              <ThemeSwitcher />
            </div>
          </header>
          <main id="main" className="mx-auto w-full min-w-0 max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">{children}</main>
        </div>

        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button type="button" aria-label="Close navigation" onClick={() => setOpen(false)} className="absolute inset-0 bg-[rgb(9_12_24/0.45)] backdrop-blur-sm" />
            <div id="admin-drawer" role="dialog" aria-modal="true" aria-label="Admin navigation" className="ad-sidebar absolute inset-y-0 left-0 flex w-[min(19rem,88vw)] flex-col border-r border-line shadow-2xl">
              <div className="flex h-14 shrink-0 items-center justify-between px-4">
                <Brand />
                <button type="button" onClick={() => { setOpen(false); btn.current?.focus(); }} aria-label="Close navigation" className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center"><X aria-hidden className="h-5 w-5" strokeWidth={1.6} /></button>
              </div>
              <NavLinks role={role} onNavigate={() => setOpen(false)} />
              <AccountCard email={email} role={role} onNavigate={() => setOpen(false)} />
            </div>
          </div>
        )}
      </div>
    </ToastProvider>
  );
}
