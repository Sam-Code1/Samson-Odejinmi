import { NextResponse, type NextRequest } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/admin/validation";

/**
 * Downloads for supplementary course FILES (PDF, ZIP, cheat sheets…). This is not, and must never become,
 * a video download endpoint. Access is decided by the student's own session through RLS:
 * the row is only readable if they're enrolled (or an admin); we then check download_enabled and sign a 60-second link.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id) || !supabaseConfigured) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(`/api/resources/${id}`)}`, _req.url));

  const { data: r } = await supabase.from("lesson_resources").select("file_path, kind, url, download_enabled, title").eq("id", id).maybeSingle();
  if (!r) return new NextResponse("Not found", { status: 404 });
  if (r.kind === "link" && r.url && /^https?:\/\//.test(r.url)) return NextResponse.redirect(r.url);
  if (!r.download_enabled || !r.file_path) return new NextResponse("This file isn't available for download.", { status: 403 });

  const service = createServiceClient();
  if (!service) return new NextResponse("Downloads aren't configured yet.", { status: 503 });
  const { data: signed, error } = await service.storage.from("course-resources").createSignedUrl(r.file_path, 60, { download: r.title });
  if (error || !signed) return new NextResponse("The file couldn't be prepared. Try again.", { status: 502 });
  return NextResponse.redirect(signed.signedUrl);
}
