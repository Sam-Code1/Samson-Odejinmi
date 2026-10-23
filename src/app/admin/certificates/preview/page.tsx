import { Certificate } from "@/components/certificate/Certificate";
import { PrintButton } from "@/components/certificate/PrintButton";
import { getCertificateDesign } from "@/lib/admin/certificate-design";
import { requirePermission } from "@/lib/admin/guard";
import { qrSvg, sampleCertificate, verifyUrl } from "@/lib/certificate-data";
import { academyRoot } from "@/app/fonts";

export const metadata = { title: "Certificate preview" };

/** Full-size specimen of the certificate design, printable to check the A4 output. */
export default async function CertificatePreview({ searchParams }: { searchParams: Promise<{ name?: string; course?: string }> }) {
  const ctx = await requirePermission("certificates");
  if (!ctx) return null;
  const sp = await searchParams;
  const d = await getCertificateDesign(ctx.supabase);
  const c = sampleCertificate({
    studentName: (sp.name ?? "").slice(0, 60) || undefined, course: (sp.course ?? "").slice(0, 120) || undefined,
    signatoryName: d.certificate_signatory_name, signatoryTitle: d.certificate_signatory_title, signatureUrl: d.certificate_signature_url,
  });
  const url = verifyUrl(c.number);
  return (
    <div className={academyRoot("space-y-6")}>
      <div className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-h2">Certificate preview</h1>
          <p className="mt-1 text-body-sm text-ink-2">A specimen with sample details. Try a long name: add <span className="font-mono">?name=…&amp;course=…</span> to the address.</p>
        </div>
        <PrintButton />
      </div>
      <Certificate c={c} qr={await qrSvg(url)} url={url} print specimen />
    </div>
  );
}
