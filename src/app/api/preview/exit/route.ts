import { draftMode } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/utils";

export async function GET(request: NextRequest) {
  (await draftMode()).disable();
  return NextResponse.redirect(new URL(safeNext(request.nextUrl.searchParams.get("path"), "/"), request.url));
}
