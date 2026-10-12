import { permanentRedirect } from "next/navigation";

/** Old verification URL. Kept so certificate links already shared keep working. */
export default async function LegacyCertificatePage({ params }: { params: Promise<{ certificateNumber: string }> }) {
  const { certificateNumber } = await params;
  permanentRedirect(`/verify/certificate/${encodeURIComponent(certificateNumber)}`);
}
