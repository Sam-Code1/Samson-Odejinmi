"use client";

import { useState } from "react";
import { Check, Download, Link2, Linkedin } from "lucide-react";

/**
 * Download (the browser's Print → Save as PDF prints just the certificate, A4 landscape), copy the verification link,
 * and LinkedIn's public "Add to profile" form, pre-filled. Nothing is sent anywhere until the visitor chooses to.
 */
export function CertificateActions({ url, course, number, issuedAt }: { url: string; course: string; number: string; issuedAt: string }) {
  const [copied, setCopied] = useState(false);
  const d = new Date(issuedAt);
  const linkedin = `https://www.linkedin.com/profile/add?${new URLSearchParams({
    startTask: "CERTIFICATION_NAME", name: course, organizationName: "Fola Academy",
    issueYear: String(d.getFullYear()), issueMonth: String(d.getMonth() + 1), certUrl: url, certId: number,
  })}`;
  const btn = "inline-flex min-h-[44px] items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold transition-colors hover:border-line-strong";
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <button type="button" onClick={() => window.print()} className="fa-btn fa-btn-primary"><Download aria-hidden className="h-4 w-4" />Download PDF</button>
      <button type="button" className={btn} onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ } }}>
        {copied ? <Check aria-hidden className="h-4 w-4 text-success" /> : <Link2 aria-hidden className="h-4 w-4" />}{copied ? "Link copied" : "Copy verification link"}
      </button>
      <a href={linkedin} target="_blank" rel="noopener noreferrer" className={btn}><Linkedin aria-hidden className="h-4 w-4" />Add to LinkedIn</a>
    </div>
  );
}
