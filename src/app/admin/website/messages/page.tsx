import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminEmpty, AdminError } from "@/components/admin/AdminStates";
import { FilterSelect, SearchInput } from "@/components/admin/Filters";
import { Pagination } from "@/components/admin/Pagination";
import { getAdminContext } from "@/lib/admin/guard";
import { PAGE_SIZE, first, formatDate, pageParam } from "@/lib/admin/validation";

export const metadata = { title: "Messages" };
type Row = { id: string; name: string; email: string; subject?: string | null; service: string | null; message: string; status: string; created_at: string };
const LABEL: Record<string, string> = { new: "unread" };

/** Website inbox. Only admins with website access can read messages (RLS); the public form can only insert. */
export default async function MessagesAdmin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const status = first(sp.status), page = pageParam(sp.page), qText = first(sp.q)?.slice(0, 80).replace(/[%,()]/g, "");
  const { supabase } = (await getAdminContext())!;
  let q = supabase.from("contact_messages").select("*", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status && ["new", "read", "replied", "archived"].includes(status)) q = q.eq("status", status);
  else q = q.neq("status", "archived");
  if (qText) q = q.or(`name.ilike.%${qText}%,email.ilike.%${qText}%,message.ilike.%${qText}%`);
  const { data, count, error } = await q;
  const rows = (data ?? []) as Row[];
  const unread = rows.filter((r) => r.status === "new").length;

  return (
    <>
      <PageHeader eyebrow="Website" title="Messages" subtitle="Your contact-form inbox. Open a message to read the whole conversation and reply from here; replies are emailed to the sender and saved in the thread." />
      <div className="mb-5 flex flex-wrap gap-3">
        <SearchInput placeholder="Search name, email or text" />
        <FilterSelect param="status" label="Show" options={[{ value: "new", label: "Unread" }, { value: "read", label: "Read" }, { value: "replied", label: "Replied" }, { value: "archived", label: "Archived" }]} />
      </div>
      {error ? <AdminError title="Unable to load messages" body="Run the latest migrations in supabase/migrations, then refresh this page." /> : rows.length === 0 ? (
        <AdminEmpty title={status || qText ? "No messages match" : "No messages yet"} body="When someone uses the contact form, their message appears here." />
      ) : (
        <>
          {unread > 0 && !status && <p className="mb-3 text-caption text-ink-3">{unread} unread on this page</p>}
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-elevated">
            {rows.map((m) => (
              <li key={m.id}>
                <Link href={`/admin/website/messages/${m.id}`} className="flex flex-col gap-1 px-4 py-4 transition-colors hover:bg-surface/60 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    {m.status === "new" && <span aria-label="Unread" className="h-2 w-2 shrink-0 rounded-full bg-blue" />}
                    <span className="min-w-0">
                      <span className={`block truncate text-body-sm ${m.status === "new" ? "font-semibold" : ""}`}>{m.name} <span className="font-normal text-ink-3">· {m.email}</span></span>
                      <span className="block truncate text-caption text-ink-2">{m.subject ? <strong className="font-semibold text-ink">{m.subject}</strong> : null}{m.subject ? " — " : ""}{m.message}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3 pl-5 sm:pl-0">
                    <StatusBadge status={LABEL[m.status] ?? m.status} />
                    <span className="text-caption text-ink-3">{formatDate(m.created_at, true)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} params={{ status, q: qText }} />
        </>
      )}
    </>
  );
}
