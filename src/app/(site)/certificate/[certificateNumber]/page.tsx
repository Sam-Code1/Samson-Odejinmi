import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { StateMessage } from "@/components/ui/States";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Certificate verification", robots: { index: false, follow: false } };

type Verified = { valid: boolean; student_name: string; course: string; issued_at: string; completed_at: string | null };

/** Public verification. Shows only: valid or not, the name, the course and the issue date. Nothing else about the student. */
export default async function CertificatePage({ params }: { params: Promise<{ certificateNumber: string }> }) {
  const { certificateNumber } = await params;
  const number = certificateNumber.toUpperCase();
  let cert: Verified | null = null;
  if (supabaseConfigured && /^[A-Z0-9-]{6,32}$/.test(number)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("verify_certificate", { p_number: number });
    cert = (data as Verified | null) ?? null;
  }

  if (!cert) {
    return <Container><StateMessage title="We couldn't find that certificate" body="Check the certificate number and try again. If you think this is a mistake, please get in touch." action={{ href: "/contact", label: "Contact" }} /></Container>;
  }
  if (!cert.valid) {
    return <Container><StateMessage title="This certificate is no longer valid" body="It was issued by Fola Academy but has since been withdrawn." action={{ href: "/academy", label: "Visit the Academy" }} /></Container>;
  }
  return (
    <Container className="py-20 sm:py-28">
      <div className="mx-auto max-w-2xl rounded-xl border border-line bg-elevated p-8 sm:p-12">
        <div className="thread h-px" aria-hidden />
        <p className="mt-8 text-label text-blue">Certificate valid</p>
        <h1 className="mt-3 text-h1">{cert.student_name || "Fola Academy student"}</h1>
        <p className="mt-4 text-body-lg text-ink-2">completed <strong className="text-ink">{cert.course}</strong> at Fola Academy.</p>
        <dl className="mt-10 grid grid-cols-2 gap-6 border-t border-line pt-6 text-body-sm">
          <div><dt className="text-caption text-ink-3">Issued</dt><dd>{new Date(cert.issued_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</dd></div>
          <div><dt className="text-caption text-ink-3">Certificate number</dt><dd className="tabular-nums">{number}</dd></div>
        </dl>
      </div>
    </Container>
  );
}
