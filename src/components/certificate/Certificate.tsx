import { useId } from "react";
import { FMark } from "@/components/brand/Brand";
import { certDate, type CertificateData } from "@/lib/certificate-data";
import { cn } from "@/lib/utils";

/** The Pathway (○ idea → understanding → □ creation), drawn for print. */
function PathwayLine() {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 120 12" aria-hidden>
      <defs><linearGradient id={`cp-${id}`} x1="0" x2="1"><stop offset="0" stopColor="#3A5CF0" /><stop offset="1" stopColor="#6E4FE8" /></linearGradient></defs>
      <circle cx="6" cy="6" r="4.3" fill="none" stroke="#3A5CF0" strokeWidth="1.5" />
      <rect x="12.5" y="5.25" width="95" height="1.5" rx="0.75" fill={`url(#cp-${id})`} />
      <rect x="110" y="1.5" width="9" height="9" fill="#6E4FE8" />
    </svg>
  );
}

/** A round seal: the constructed F inside "FOLA ACADEMY · CERTIFIED COMPLETION ·" set on a circle. */
function Seal() {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 100 100" className="cert-seal" aria-hidden>
      <defs><path id={`seal-${id}`} d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" /></defs>
      <circle cx="50" cy="50" r="48" fill="none" stroke="#2D4BD6" strokeWidth="0.8" />
      <circle cx="50" cy="50" r="29" fill="#F4F1EA" stroke="#2D4BD6" strokeWidth="0.8" strokeDasharray="1.2 2.2" />
      <text><textPath href={`#seal-${id}`} startOffset="0">Fola Academy · Certified completion ·</textPath></text>
      <svg x="32" y="32" width="36" height="36" viewBox="0 0 48 48" overflow="visible"><FMark className="h-full w-full" /></svg>
    </svg>
  );
}

/**
 * The Fola Academy certificate of completion (Brand Guidelines: constructed F, Pathway, Paper + Night, Schibsted Grotesk /
 * Newsreader / Geist Mono). The student's name and course, the completion date, the signatory (signature image if one
 * is uploaded in Academy settings, otherwise the name set in Newsreader italic), the certificate ID and a QR code that
 * opens the public verification page. Add `print` to the main one on a page so Print / Save as PDF outputs just it.
 */
export function Certificate({ c, qr, url, print, specimen, className }: {
  c: CertificateData; qr: string; url: string; print?: boolean; specimen?: boolean; className?: string;
}) {
  const name = c.studentName || "Fola Academy student";
  const nameSize = name.length > 34 ? "3.6cqw" : name.length > 26 ? "4.3cqw" : "5.4cqw";
  const meta = [c.level, c.duration, "Self-paced course"].filter(Boolean).join("  ·  ");
  const shortUrl = url.replace(/^https?:\/\//, "");
  return (
    <div className={cn("cert-sheet", className)} data-print={print ? "" : undefined} role="img"
      aria-label={`Fola Academy certificate of completion: ${name}, ${c.course}, ${certDate(c.completedAt ?? c.issuedAt)}. Certificate ID ${c.number}.`}>
      <div className="cert">
        <aside className="cert-band">
          <div>
            <FMark className="cert-mark" />
            <p className="cert-wordmark"><span className="font-extrabold">Fola</span> <span className="font-medium">Academy</span></p>
            <p className="cert-mono cert-band-label">Creative &amp; technical education</p>
          </div>
          <div>
            {/* eslint-disable-next-line react/no-danger -- QR SVG generated locally by the qrcode library from our own URL. */}
            <div className="cert-qr" dangerouslySetInnerHTML={{ __html: qr }} />
            <p className="cert-mono cert-verify">Scan or visit to verify<br />{shortUrl}</p>
          </div>
        </aside>

        <div className="cert-body">
          <span className="cert-corner tl" /><span className="cert-corner tr" /><span className="cert-corner bl" /><span className="cert-corner br" />
          <Seal />
          <p className="cert-mono cert-kicker"><PathwayLine />Certificate of completion</p>
          <div className="cert-main">
          <p className="cert-lead">This certifies that</p>
          <p className="cert-name" style={{ fontSize: nameSize }}>{name}</p>
          <div className="cert-rule" />
          <p className="cert-lead small">has successfully completed the course</p>
          <p className="cert-course">{c.course}</p>
          <p className="cert-meta">{meta}</p>
          </div>

          <div className="cert-foot">
            <div>
              <div className="cert-sig">
                {c.signatureUrl
                  // eslint-disable-next-line @next/next/no-img-element -- printed artwork; a plain img prints reliably
                  ? <img src={c.signatureUrl} alt={`Signature of ${c.signatoryName}`} />
                  : <span className="cert-sig-typed">{c.signatoryName}</span>}
              </div>
              <div className="cert-line"><p className="cert-v">{c.signatoryName}</p><p className="cert-mono cert-k">{c.signatoryTitle}</p></div>
            </div>
            <div className="cert-line"><p className="cert-mono cert-k">Date of completion</p><p className="cert-v">{certDate(c.completedAt ?? c.issuedAt)}</p></div>
            <div className="cert-line"><p className="cert-mono cert-k">Certificate ID</p><p className="cert-v mono">{c.number}</p></div>
          </div>
        </div>
      </div>
      {!c.valid && <span className="cert-stamp revoked">Revoked</span>}
      {specimen && <span className="cert-stamp specimen">Specimen</span>}
    </div>
  );
}
