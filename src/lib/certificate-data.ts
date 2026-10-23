import QRCode from "qrcode";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { site } from "@/lib/site";

/** Everything the certificate artwork and the verification page show. Never the student's email or account details. */
export type CertificateData = {
  valid: boolean;
  studentName: string;
  course: string;
  courseSlug: string | null;
  level: string | null;
  duration: string | null;
  issuedAt: string;
  completedAt: string | null;
  number: string;
  signatoryName: string;
  signatoryTitle: string;
  signatureUrl: string | null;
};

export const CERT_ID = /^[A-Z0-9-]{6,40}$/;
export const normaliseCertId = (raw: string) => decodeURIComponent(raw).trim().toUpperCase();

/**
 * The public verification address, always on the live domain (site.url: NEXT_PUBLIC_SITE_URL, else Vercel's production
 * domain). Printed on certificates and encoded in their QR code, so it must never be localhost on a deployment.
 */
export const verifyUrl = (number: string) => `${site.url}/verify/certificate/${encodeURIComponent(number)}`;

/** A crisp, scalable QR code (SVG markup) for the verification link. Generated locally; nothing is sent anywhere. */
export async function qrSvg(url: string) {
  return QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0B1020", light: "#FFFFFF" } });
}

export const certDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

/** Looks a certificate up through the public verify_certificate() function (works signed out). */
export async function getCertificate(raw: string): Promise<CertificateData | null> {
  const id = normaliseCertId(raw);
  if (!supabaseConfigured || !CERT_ID.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("verify_certificate", { p_number: id });
  if (!data || typeof data !== "object") return null;
  const r = data as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    valid: r.valid === true, studentName: s(r.student_name) ?? "", course: s(r.course) ?? "", courseSlug: s(r.course_slug),
    level: s(r.level), duration: s(r.duration), issuedAt: String(r.issued_at), completedAt: s(r.completed_at), number: String(r.certificate_number),
    // Before migration 0017 these aren't returned yet: the founder signs by default.
    signatoryName: s(r.signatory_name) ?? "Samson Afolabi Odejinmi", signatoryTitle: s(r.signatory_title) ?? "Founder, Fola Academy",
    signatureUrl: s(r.signature_url),
  };
}

/** A sample for the admin preview and the course page. Clearly a specimen, never a real record. */
export function sampleCertificate(over: Partial<CertificateData> = {}): CertificateData {
  return {
    valid: true, studentName: "Your Name Here", course: "Blender Foundations", courseSlug: null, level: "Beginner", duration: null,
    issuedAt: new Date().toISOString(), completedAt: new Date().toISOString(), number: "FOLA-ACADEMY-CERT-SAMPLE",
    signatoryName: "Samson Afolabi Odejinmi", signatoryTitle: "Founder, Fola Academy", signatureUrl: null, ...over,
  };
}
