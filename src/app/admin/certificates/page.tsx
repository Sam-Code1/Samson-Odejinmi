import Link from "next/link";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable } from "@/components/admin/DataTable";
import { Pagination } from "@/components/admin/Pagination";
import { SearchInput } from "@/components/admin/Filters";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ActionButton } from "@/components/admin/ActionButton";
import { AdminError } from "@/components/admin/AdminStates";
import { setCertificateRevoked } from "@/app/admin/actions/people";
import { requirePermission } from "@/lib/admin/guard";
import { Panel } from "@/components/admin/PageHeader";
import { IssueCertificateForm } from "@/components/admin/IssueCertificateForm";
import { CertificateDesignForm } from "@/components/admin/CertificateDesignForm";
import { Certificate } from "@/components/certificate/Certificate";
import { getCertificateDesign } from "@/lib/admin/certificate-design";
import { getLibraryImages } from "@/lib/admin/media";
import { qrSvg, sampleCertificate, verifyUrl } from "@/lib/certificate-data";
import { academyRoot } from "@/app/fonts";
import { personName, type Person } from "@/lib/admin/format";
import { PAGE_SIZE, first, formatDate, pageParam, safeSearch } from "@/lib/admin/validation";

export const metadata = { title: "Certificates" };
type Row = { id: string; certificate_number: string; issued_at: string; completed_at: string | null; revoked: boolean; courses: { title: string } | null; profiles: Person };

export default async function CertificatesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const q = safeSearch(first(sp.q) ?? "").toUpperCase(), page = pageParam(sp.page);
  const ctx = await requirePermission("certificates");
  if (!ctx) return null;
  const { supabase } = ctx;
  let query = supabase.from("certificates").select("id, certificate_number, issued_at, completed_at, revoked, courses(title), profiles(first_name, last_name, email)", { count: "exact" }).order("issued_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) query = query.ilike("certificate_number", `%${q}%`);
  const canDesign = ctx.can("settings");
  const [{ data, count, error }, { data: courses }, design, library] = await Promise.all([
    query, supabase.from("courses").select("id, title").neq("status", "archived").order("title"),
    getCertificateDesign(supabase), canDesign ? getLibraryImages(ctx) : Promise.resolve([]),
  ]);
  const sample = sampleCertificate({ signatoryName: design.certificate_signatory_name, signatoryTitle: design.certificate_signatory_title, signatureUrl: design.certificate_signature_url });
  const sampleUrl = verifyUrl(sample.number);
  const sampleQr = await qrSvg(sampleUrl);

  return (
    <>
      <PageHeader title="Certificates" subtitle="Issued automatically when a student completes every lesson (and, if the course requires it, passes every quiz) in a course with certificates turned on. IDs look like FOLA-ACADEMY-CERT-2026-000001." />
      <Panel title="Certificate design" className="mb-8" description="Every certificate uses this design: the Fola Academy brand, the student's name, the course, the completion date, the signatory, the certificate ID and a QR code that opens its public verification page.">
        <div className="grid gap-8 xl:grid-cols-[1fr_24rem]">
          <div className={academyRoot()}><Certificate c={sample} qr={sampleQr} url={sampleUrl} specimen /></div>
          <div className="space-y-4">
            {canDesign ? <CertificateDesignForm d={design} library={library} /> : <p className="text-body-sm text-ink-2">Only admins with Settings access can change who signs certificates.</p>}
            <p className="text-caption text-ink-3">Verification links use <span className="font-mono">{sampleUrl.replace(/\/verify.*$/, "")}</span>. <Link href="/admin/certificates/preview" target="_blank" className="underline underline-offset-4">Open the full-size preview</Link></p>
          </div>
        </div>
      </Panel>
      <Panel title="Issue a certificate manually" className="mb-8"><IssueCertificateForm courses={(courses ?? []) as { id: string; title: string }[]} /></Panel>
      <div className="mb-5"><SearchInput placeholder="Search certificate number" /></div>
      {error ? <AdminError /> : (
        <>
          <DataTable<Row> rows={(data ?? []) as unknown as Row[]} rowKey={(r) => r.id}
            empty={{ title: "No certificates yet", body: "They appear here after students complete a course with certificates enabled.", action: { href: "/admin/courses", label: "Go to courses" } }}
            columns={[
              { key: "n", header: "Number", primary: true, cell: (r) => <Link href={`/verify/certificate/${r.certificate_number}`} className="font-medium hover:underline">{r.certificate_number}</Link> },
              { key: "s", header: "Student", cell: (r) => personName(r.profiles) },
              { key: "c", header: "Course", cell: (r) => r.courses?.title ?? "–" },
              { key: "d", header: "Issued", cell: (r) => formatDate(r.issued_at) },
              { key: "st", header: "Status", cell: (r) => <StatusBadge status={r.revoked ? "revoked" : "valid"} /> },
              { key: "a", header: "", className: "text-right", hideOnMobile: true, cell: (r) => r.revoked
                ? <ActionButton action={setCertificateRevoked} fields={{ certificateId: r.id, revoked: "no" }} variant="outline">Restore</ActionButton>
                : <ActionButton action={setCertificateRevoked} fields={{ certificateId: r.id, revoked: "yes" }} variant="danger" confirm={{ title: "Revoke this certificate?", body: "Its public verification page will show it as no longer valid.", label: "Revoke" }}>Revoke</ActionButton> },
            ]} />
          <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} params={{ q: q || undefined }} />
        </>
      )}
    </>
  );
}
