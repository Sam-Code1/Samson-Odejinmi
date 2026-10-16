"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell } from "lucide-react";
import { getMyNotifications, markNotificationsRead, type NotificationItem } from "@/app/app-actions";
import { cn } from "@/lib/utils";

const ago = (iso: string) => {
  const s = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 1000));
  return s < 60 ? "just now" : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`;
};

/** Notification centre: unread count, list, mark read / mark all read. Refreshes every 2 minutes while the tab is visible. */
export function NotificationBell() {
  const [data, setData] = useState<{ items: NotificationItem[]; unread: number } | null>(null);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => { setData(await getMyNotifications()); }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(() => { if (document.visibilityState === "visible") load(); }, 120_000);
    return () => window.clearInterval(id);
  }, [load]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { const t = e.target as Node; if (!box.current?.contains(t) && !panel.current?.contains(t)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!data) return null; // signed out, or notifications not set up yet
  const markAll = async () => { await markNotificationsRead(null); await load(); };
  const markOne = async (id: string) => { await markNotificationsRead([id]); setData((d) => d && { items: d.items.map((i) => (i.id === id ? { ...i, is_read: true } : i)), unread: Math.max(0, d.unread - 1) }); };

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => { setOpen((o) => !o); if (!open) load(); }} aria-expanded={open} aria-haspopup="dialog"
        aria-label={data.unread ? `Notifications, ${data.unread} unread` : "Notifications"} className="relative flex h-11 w-11 items-center justify-center rounded text-ink-2 hover:bg-surface hover:text-ink">
        <Bell aria-hidden className="h-5 w-5" strokeWidth={1.5} />
        {data.unread > 0 && <span aria-hidden className="absolute right-1.5 top-1.5 min-w-[1.1rem] rounded-full bg-blue px-1 text-center text-[0.6875rem] font-semibold leading-[1.1rem] text-white">{data.unread > 9 ? "9+" : data.unread}</span>}
      </button>
      {/* Portal + fixed: stays on screen on phones and isn't trapped by the blurred header. */}
      {open && createPortal(
        <div ref={panel} role="dialog" aria-label="Notifications" className="fixed inset-x-3 top-[4.25rem] z-50 sm:left-auto sm:right-4 sm:w-96 max-h-[70vh] overflow-hidden rounded-lg border border-line bg-elevated shadow-[0_24px_60px_-24px_rgb(var(--ink)/0.45)]">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <p className="text-label">Notifications</p>
            {data.unread > 0 && <button type="button" onClick={markAll} className="min-h-[36px] rounded px-2 text-caption font-semibold text-blue hover:bg-surface">Mark all read</button>}
          </div>
          <ul className="max-h-[calc(70vh-3.5rem)] overflow-y-auto">
            {data.items.length === 0 && <li className="px-4 py-8 text-center text-body-sm text-ink-3">Nothing yet. Purchases, messages, sign-ups and certificates appear here.</li>}
            {data.items.map((n) => {
              const inner = (
                <>
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.is_read ? "bg-transparent" : "bg-blue")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-body-sm", !n.is_read && "font-semibold")}>{n.title}</span>
                    {n.body && <span className="block truncate text-caption text-ink-3">{n.body}</span>}
                    <span className="block text-meta text-ink-3">{ago(n.created_at)}{!n.is_read && <span className="sr-only"> · unread</span>}</span>
                  </span>
                </>
              );
              const cls = "flex w-full gap-3 border-b border-line px-4 py-3 text-left last:border-0 hover:bg-surface/60";
              return (
                <li key={n.id}>
                  {n.link ? <Link href={n.link} className={cls} onClick={() => { if (!n.is_read) markOne(n.id); setOpen(false); }}>{inner}</Link>
                    : <button type="button" className={cls} onClick={() => !n.is_read && markOne(n.id)}>{inner}</button>}
                </li>
              );
            })}
          </ul>
        </div>,
        document.body,
      )}
    </div>
  );
}
