import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * RFC 8058 one-click unsubscribe (mail apps POST here from the List-Unsubscribe header).
 * GET does nothing but point to the confirmation page, so link scanners can't unsubscribe people.
 */
const isToken = (v: string | null) => !!v && /^[a-f0-9]{64}$/.test(v);
const isUuid = (v: string | null) => !!v && /^[0-9a-f-]{36}$/i.test(v);

export async function POST(req: NextRequest) {
  const t = req.nextUrl.searchParams.get("t"), m = req.nextUrl.searchParams.get("m");
  if (!isToken(t)) return new NextResponse("Invalid link", { status: 400 });
  const service = createServiceClient();
  if (!service) return new NextResponse("Not configured", { status: 503 });
  const { data, error } = await service.rpc("unsubscribe_by_token", { p_token: t, p_message: isUuid(m) ? m : null });
  if (error) return new NextResponse("Try again later", { status: 500 });
  return NextResponse.json({ unsubscribed: (data as { ok?: boolean } | null)?.ok === true }, { headers: { "X-Robots-Tag": "noindex" } });
}

export async function GET(req: NextRequest) {
  const to = req.nextUrl.clone();
  to.pathname = "/unsubscribe";
  return NextResponse.redirect(to, { status: 303 });
}
