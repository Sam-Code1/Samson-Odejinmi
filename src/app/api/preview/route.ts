import { draftMode } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { isAdmin } from "@/lib/auth";
import { safeNext } from "@/lib/utils";

/**
 * Turns on preview (Next.js draft mode) for the current admin and redirects to a public page.
 * The admin check happens here, on the server. In preview, public pages read with the admin's own session, so the
 * database (RLS) only returns drafts to admins: even a copied preview cookie reveals nothing to anyone else.
 */
export async function GET(request: NextRequest) {
  const path = safeNext(request.nextUrl.searchParams.get("path"), "/");
  if (!(await isAdmin())) return new NextResponse("Not authorised", { status: 403 });
  (await draftMode()).enable();
  return NextResponse.redirect(new URL(path, request.url));
}
