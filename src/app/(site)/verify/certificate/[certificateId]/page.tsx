import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { StateMessage } from "@/components/ui/States";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Certificate verification", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Verified = { valid: boolean; student_name: string; course: string; instructor: string | null; issued_at: string; completed_at: string | null; certificate_number: string };
const fmt = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/**
 * Public certificate verification. Shows only what a verifier needs: valid or not, the name on the certificate,
 * the course, dates, the certificate ID and the issuer. Never the student's email or account details.
 */
export default async function VerifyCertificatePage({ params }: { params: Promise<{ certificateId: string }> }) {
  const { certificateId } = await params;
  const id = decodeURIComponent(certificateId).trim().toUpperCase();
  let cert: Verified | null = null;
  if (supabaseConfigured && /^[A-Z0-9-]{6,40}$/.test(id)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("verify_certificate", { p_number: id });
    cert = (data as Verified | null) ?? null;
  }

  if (!cert) {
    return <Container><StateMessage title="Certificate not found" body={`No Fola Academy certificate has the ID “${id.slice(0, 40)}”. Check it and try again.`} action={{ href: "/contact", label: "Contact us" }} /></Container>;
  }
  if (!cert.valid) {
    return <Container><StateMessage title="This certificate is not valid" body={`Certificate ${cert.certificate_number} was issued by Fola Academy but has since been revoked.`} action={{ href: "/academy", label: "Visit the Academy" }} /></Container>;
  }
  return (
    <Container className="py-16 sm:py-24">
      <article className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-line bg-elevated">
        <div className="thread h-px" aria-hidden />
        <div className="p-8 sm:p-14">
          <p className="flex items-center gap-2 text-label text-blue"><span aria-hidden className="inline-block h-2 w-2 rounded-full bg-blue" />Verified certificate</p>
          <p className="mt-10 text-caption uppercase tracking-[0.18em] text-ink-3">Fola Academy certifies that</p>
          <h1 className="mt-3 text-h1">{cert.student_name || "A Fola Academy student"}</h1>
          <p className="mt-5 text-body-lg text-ink-2">has completed</p>
          <p className="mt-2 text-h2">{cert.course}</p>
          <dl className="mt-12 grid gap-6 border-t border-line pt-6 text-body-sm sm:grid-cols-2">
            <div><dt className="text-caption text-ink-3">Completed</dt><dd>{fmt(cert.completed_at ?? cert.issued_at)}</dd></div>
            <div><dt className="text-caption text-ink-3">Issued</dt><dd>{fmt(cert.issued_at)}</dd></div>
            <div><dt className="text-caption text-ink-3">Certificate ID</dt><dd className="font-semibold tabular-nums">{cert.certificate_number}</dd></div>
            <div><dt className="text-caption text-ink-3">Issued by</dt><dd>Fola Academy{cert.instructor ? ` · Instructor: ${cert.instructor}` : ""}</dd></div>
          </dl>
          <p className="mt-8 text-caption text-ink-3">Verify at {site.url.replace(/^https?:\/\//, "")}/verify/certificate/{cert.certificate_number}</p>
        </div>
      </article>
    </Container>
  );
}
