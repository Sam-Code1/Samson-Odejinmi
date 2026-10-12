import { Archive, Mail, MailOpen, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/admin/PageHeader";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminEmpty, AdminError } from "@/components/admin/AdminStates";
import { FilterSelect } from "@/components/admin/Filters";
import { Pagination } from "@/components/admin/Pagination";
import { deleteMessage, setMessageStatus } from "@/app/admin/actions/website";
import { getAdminContext } from "@/lib/admin/guard";
import { PAGE_SIZE, first, formatDate, pageParam } from "@/lib/admin/validation";

export const metadata = { title: "Messages" };
type Row = { id: string; name: string; email: string; service: string | null; message: string; status: string; created_at: string };

/** Contact form submissions. Only admins can read these (RLS); the public form can only insert through a function. */
export default async function MessagesAdmin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const status = first(sp.status), page = pageParam(sp.page);
  const { supabase } = (await getAdminContext())!;
  let q = supabase.from("contact_messages").select("*", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status && ["new", "read", "archived"].includes(status)) q = q.eq("status", status);
  else q = q.neq("status", "archived");
  const { data, count, error } = await q;
  const rows = (data ?? []) as Row[];

  return (
    <>
      <PageHeader eyebrow="Website" title="Messages" subtitle="Enquiries sent through the contact form. Reply from your own email app." />
      <div className="mb-5"><FilterSelect param="status" label="Show" options={[{ value: "new", label: "New" }, { value: "read", label: "Read" }, { value: "archived", label: "Archived" }]} /></div>
      {error ? <AdminError title="Unable to load messages" body="Run supabase/migrations/0003_website_cms.sql, then refresh this page." /> : rows.length === 0 ? (
        <AdminEmpty title={status ? "No messages here" : "No messages yet"} body="When someone uses the contact form, their message appears here." />
      ) : (
        <>
          <ul className="space-y-3">
            {rows.map((m) => (
              <li key={m.id} className={`rounded-lg border bg-elevated p-5 ${m.status === "new" ? "border-blue/40" : "border-line"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-body font-semibold">{m.name}</p>
                    <p className="text-caption text-ink-3"><a href={`mailto:${m.email}`} className="underline underline-offset-4 hover:text-ink">{m.email}</a>{m.service ? ` · ${m.service}` : ""} · {formatDate(m.created_at, true)}</p>
                  </div>
                  <StatusBadge status={m.status} />
                </div>
                <p className="mt-4 whitespace-pre-line text-body-sm text-ink-2">{m.message}</p>
                <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-line pt-3">
                  {m.status === "new"
                    ? <ActionButton action={setMessageStatus} fields={{ messageId: m.id, to: "read" }}><MailOpen aria-hidden className="h-3.5 w-3.5" />Mark read</ActionButton>
                    : <ActionButton action={setMessageStatus} fields={{ messageId: m.id, to: "new" }}><Mail aria-hidden className="h-3.5 w-3.5" />Mark unread</ActionButton>}
                  {m.status !== "archived" && <ActionButton action={setMessageStatus} fields={{ messageId: m.id, to: "archived" }}><Archive aria-hidden className="h-3.5 w-3.5" />Archive</ActionButton>}
                  <ActionButton action={deleteMessage} fields={{ messageId: m.id }} variant="danger" className="ml-auto" ariaLabel="Delete message" confirm={{ title: "Delete this message?", body: "It's removed permanently.", label: "Delete" }}><Trash2 aria-hidden className="h-3.5 w-3.5" /></ActionButton>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} params={{ status }} />
        </>
      )}
    </>
  );
}
