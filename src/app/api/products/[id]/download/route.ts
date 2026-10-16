import { NextResponse, type NextRequest } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/admin/validation";

export const dynamic = "force-dynamic";

/**
 * Secure product delivery. The person's OWN session asks the database (prepare_product_download) whether they own the
 * product: it checks the entitlement, rate-limits (20/hour) and logs the download. Only then is a 60-second signed
 * link created for the private product-files bucket. There is no permanent public URL, and nothing here is indexable.
 */
const NOINDEX = { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "private, no-store" };

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id) || !supabaseConfigured) return new NextResponse("Not found", { status: 404, headers: NOINDEX });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent("/library")}`, req.url), { headers: NOINDEX });

  const { data, error } = await supabase.rpc("prepare_product_download", { p_product: id });
  const r = data as { ok: boolean; error?: string; file_path?: string; file_name?: string } | null;
  if (error || !r) return new NextResponse("The download couldn't be prepared. Try again.", { status: 502, headers: NOINDEX });
  if (!r.ok) {
    const msg = r.error === "rate_limited" ? "Too many downloads in the last hour. Please try again later." : r.error === "no_file" ? "This file isn't available yet." : "You don't have access to this download.";
    return new NextResponse(msg, { status: r.error === "rate_limited" ? 429 : r.error === "no_file" ? 404 : 403, headers: NOINDEX });
  }

  const service = createServiceClient();
  if (!service) return new NextResponse("Downloads aren't configured yet.", { status: 503, headers: NOINDEX });
  const { data: signed, error: se } = await service.storage.from("product-files").createSignedUrl(r.file_path!, 60, { download: r.file_name });
  if (se || !signed) return new NextResponse("The file couldn't be prepared. Try again.", { status: 502, headers: NOINDEX });
  return NextResponse.redirect(signed.signedUrl, { headers: NOINDEX });
}
