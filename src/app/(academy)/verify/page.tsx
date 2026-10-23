import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight, Lock, QrCode, ShieldCheck } from "lucide-react";
import { FaContainer } from "@/components/brand/Shell";
import { CERT_ID, normaliseCertId } from "@/lib/certificate-data";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Verify a certificate — Fola Academy",
  description: "Check that a Fola Academy certificate of completion is genuine. Enter the certificate ID printed on it, or scan its QR code.",
  alternates: { canonical: "/verify" },
};

/** Look up a certificate by its ID (GET ?id=…), then show it on /verify/certificate/<id>. */
export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id: raw } = await searchParams;
  const id = raw ? normaliseCertId(raw.slice(0, 60)) : "";
  if (id && CERT_ID.test(id)) redirect(`/verify/certificate/${encodeURIComponent(id)}`);
  const invalid = !!raw && !CERT_ID.test(id);

  return (
    <section className="fa-blueprint border-b border-line">
      <FaContainer className="grid gap-12 py-16 sm:py-24 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <p className="fa-label">Certificates</p>
          <h1 className="mt-4 text-h1">Verify a Fola Academy certificate.</h1>
          <p className="mt-6 max-w-prose text-body-lg text-ink-2">Every certificate we issue has a unique ID and its own verification page on {site.url.replace(/^https?:\/\//, "")}. Enter the ID printed on the certificate, or scan its QR code.</p>
          <form action="/verify" method="get" className="mt-10 max-w-lg">
            <label htmlFor="cert-id" className="fa-label">Certificate ID</label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <input id="cert-id" name="id" required defaultValue={raw ?? ""} placeholder="FOLA-ACADEMY-CERT-2026-000001" autoComplete="off" spellCheck={false}
                aria-invalid={invalid} aria-describedby={invalid ? "cert-id-error" : undefined}
                className="h-12 min-w-0 flex-1 rounded-[6px] border border-line bg-surface px-4 font-mono text-sm uppercase tracking-wide text-ink placeholder:normal-case placeholder:text-ink-3 focus:border-blue focus:outline-none" />
              <button type="submit" className="fa-btn fa-btn-primary h-12 px-6">Verify<ArrowRight aria-hidden className="fa-arrow h-4 w-4" /></button>
            </div>
            {invalid && <p id="cert-id-error" role="alert" className="mt-2 text-body-sm text-caution">That doesn&apos;t look like a certificate ID. It&apos;s printed at the bottom right of the certificate.</p>}
          </form>
        </div>
        <ul className="grid content-start gap-4 lg:col-span-5 lg:col-start-8">
          {[
            { icon: ShieldCheck, title: "Issued only by us", body: "Certificates are created by the Academy when a student completes a course, or issued by an administrator. They can't be made or edited by anyone else." },
            { icon: QrCode, title: "Scan to check", body: "The QR code on every certificate opens its page here, showing the name, the course and the completion date." },
            { icon: Lock, title: "Private by design", body: "Verification shows only what's printed on the certificate. Never an email address or account details." },
          ].map(({ icon: Icon, title, body }) => (
            <li key={title} className="fa-card flex gap-4 p-5"><Icon aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-blue" /><div><p className="text-h4">{title}</p><p className="mt-1 text-body-sm text-ink-2">{body}</p></div></li>
          ))}
        </ul>
      </FaContainer>
    </section>
  );
}
