import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { ATTR_COOKIE, ATTR_MAX_AGE, REF_COOKIE, REF_MAX_AGE, mergeAttribution, parseAttribution, serializeAttribution, touchFromUrl } from "@/lib/attribution";

const SESSION_PATHS = ["/dashboard", "/courses", "/profile", "/settings", "/learn", "/admin", "/library", "/affiliate", "/login", "/register", "/forgot-password"];
const needsSession = (path: string) => SESSION_PATHS.some((b) => path === b || path.startsWith(b + "/"));

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Referral link visit → one click row (de-duplicated per visitor in the database). Never blocks the page. */
async function recordClick(code: string, path: string, request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return;
  const salt = process.env.AFFILIATE_CLICK_SALT ?? process.env.AI_RATE_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const visitor = salt && ip ? await sha256Hex(`${salt}:${ip}:${request.headers.get("user-agent") ?? ""}`) : null;
  try {
    await fetch(`${url}/rest/v1/rpc/record_affiliate_click`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_code: code, p_path: path, p_visitor: visitor }),
    });
  } catch { /* best effort */ }
}

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  const path = request.nextUrl.pathname;
  const touch = touchFromUrl(request.nextUrl);
  const response = needsSession(path) ? await updateSession(request) : NextResponse.next();

  if (touch) {
    const secure = process.env.NODE_ENV === "production";
    const attr = mergeAttribution(parseAttribution(request.cookies.get(ATTR_COOKIE)?.value), touch);
    response.cookies.set(ATTR_COOKIE, serializeAttribution(attr), { httpOnly: true, sameSite: "lax", secure, maxAge: ATTR_MAX_AGE, path: "/" });
    if (touch.ref) {
      response.cookies.set(REF_COOKIE, touch.ref, { httpOnly: true, sameSite: "lax", secure, maxAge: REF_MAX_AGE, path: "/" });
      event.waitUntil(recordClick(touch.ref, path, request));
    }
  }
  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*", "/courses/:path*", "/profile/:path*", "/settings/:path*", "/learn/:path*", "/admin/:path*",
    "/library/:path*", "/affiliate/:path*", "/login", "/register", "/forgot-password",
    // Tagged links only (referral or UTM), on any page. Ordinary page views never run middleware.
    { source: "/((?!_next/|api/|.*\\..*).*)", has: [{ type: "query", key: "ref" }] },
    { source: "/((?!_next/|api/|.*\\..*).*)", has: [{ type: "query", key: "utm_source" }] },
    { source: "/((?!_next/|api/|.*\\..*).*)", has: [{ type: "query", key: "utm_campaign" }] },
  ],
};
