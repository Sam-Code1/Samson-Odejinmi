import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, CircleAlert, SearchX } from "lucide-react";
import { FaContainer } from "@/components/brand/Shell";
import { Certificate } from "@/components/certificate/Certificate";
import { CertificateActions } from "@/components/certificate/CertificateActions";
import { certDate, getCertificate, normaliseCertId, qrSvg, verifyUrl } from "@/lib/certificate-data";
import { site } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ certificateId: string }> }): Promise<Metadata> {
  const { certificateId } = await params;
  const c = await getCertificate(certificateId);
  // Certificates aren't for search engines; the page exists for whoever holds the link.
  const robots = { index: false, follow: false };
  if (!c || !c.valid) return { title: "Certificate verification — Fola Academy", robots };
  const title = `${c.studentName || "A student"} completed ${c.course} — Fola Academy`;
  return { title, description: `Verified Fola Academy certificate ${c.number}, completed ${certDate(c.completedAt ?? c.issuedAt)}.`, robots,
    openGraph: { title, url: verifyUrl(c.number), description: "A verified certificate of completion from Fola Academy." } };
}

/**
 * Public certificate page: the verification result first (valid / revoked / not found), then the certificate itself,
 * printable as an A4 PDF. Shows only what is printed on the certificate. Never the student's email or account details.
 */
export default async function VerifyCertificatePage({ params }: { params: Promise<{ certificateId: string }> }) {
  const { certificateId } = await params;
  const id = normaliseCertId(certificateId).slice(0, 40);
  const c = await getCertificate(certificateId);

  if (!c) {
    return (
      <FaContainer className="py-20 sm:py-28">
        <div className="max-w-2xl">
          <SearchX aria-hidden className="h-8 w-8 text-caution" />
          <h1 className="mt-5 text-h1">No certificate with that ID.</h1>
          <p className="mt-5 text-body-lg text-ink-2">We couldn&apos;t find a Fola Academy certificate with the ID <span className="font-mono text-ink">{id || "(empty)"}</span>. Check the ID on the certificate (letters, numbers and hyphens) and try again. A certificate that can&apos;t be found here was not issued by Fola Academy.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link href="/verify" className="fa-btn fa-btn-primary">Try another ID</Link><Link href="/contact" className="fa-btn fa-btn-secondary">Contact us</Link></div>
        </div>
      </FaContainer>
    );
  }

  const url = verifyUrl(c.number);
  const qr = await qrSvg(url);
  const completed = certDate(c.completedAt ?? c.issuedAt);

  return (
    <>
      <section className="border-b border-line print:hidden">
        <FaContainer className="grid gap-8 py-10 sm:py-14 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            {c.valid ? (
              <p className="inline-flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-3 py-1.5 text-sm font-semibold text-success"><BadgeCheck aria-hidden className="h-4 w-4" />Verified · issued by Fola Academy</p>
            ) : (
              <p className="inline-flex items-center gap-2 rounded-full border border-caution/40 bg-caution/10 px-3 py-1.5 text-sm font-semibold text-caution"><CircleAlert aria-hidden className="h-4 w-4" />Revoked · this certificate is no longer valid</p>
            )}
            <h1 className="mt-5 text-h1">{c.valid ? <>{c.studentName || "This student"} completed <span className="font-book italic font-normal">{c.course}</span>.</> : <>Certificate {c.number} has been revoked.</>}</h1>
            <p className="mt-4 max-w-prose text-body-lg text-ink-2">
              {c.valid
                ? `Completed on ${completed}. This page is the official record: if the details here match the certificate you were shown, it's genuine.`
                : "It was issued by Fola Academy but has since been withdrawn, so it should not be accepted as proof of completion."}
            </p>
          </div>
          {c.valid && <div className="lg:col-span-4 lg:justify-self-end"><CertificateActions url={url} course={c.course} number={c.number} issuedAt={c.issuedAt} /></div>}
        </FaContainer>
      </section>

      <section className="fa-dots">
        <FaContainer className="py-10 sm:py-14">
          <Certificate c={c} qr={qr} url={url} print className="mx-auto max-w-[1100px]" />
          <dl className="mx-auto mt-10 grid max-w-[1100px] gap-6 border-t border-line pt-6 text-body-sm sm:grid-cols-2 lg:grid-cols-4 print:hidden">
            <div><dt className="fa-label">Name on certificate</dt><dd className="mt-1.5">{c.studentName || "Not set"}</dd></div>
            <div><dt className="fa-label">Course</dt><dd className="mt-1.5">{c.courseSlug && c.valid ? <Link href={`/academy/courses/${c.courseSlug}`} className="underline underline-offset-4 hover:text-blue">{c.course}</Link> : c.course}</dd></div>
            <div><dt className="fa-label">Completed · Issued</dt><dd className="mt-1.5">{completed} · {certDate(c.issuedAt)}</dd></div>
            <div><dt className="fa-label">Certificate ID</dt><dd className="mt-1.5 font-mono">{c.number}</dd></div>
          </dl>
          <p className="mx-auto mt-6 max-w-[1100px] text-caption text-ink-3 print:hidden">A certificate of completion from Fola Academy confirms the holder finished every required lesson (and quiz, where the course requires it). It is not an accredited academic qualification. Verify any certificate at {site.url.replace(/^https?:\/\//, "")}/verify.</p>
        </FaContainer>
      </section>
    </>
  );
}
