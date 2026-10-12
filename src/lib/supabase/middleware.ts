import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/dashboard", "/courses", "/profile", "/settings", "/learn", "/admin"];
const AUTH_PAGES = ["/login", "/register", "/forgot-password"];

const matches = (path: string, bases: string[]) => bases.some((b) => path === b || path.startsWith(b + "/"));

/**
 * Refreshes the Supabase session and applies a first-line redirect for protected routes.
 * This is a convenience only: every protected page and action re-checks on the server, and RLS enforces access.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = request.nextUrl.pathname;

  if (!url || !key) {
    if (matches(path, PROTECTED)) {
      const to = request.nextUrl.clone();
      to.pathname = "/login";
      to.search = "";
      return NextResponse.redirect(to);
    }
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list: { name: string; value: string; options: CookieOptions }[]) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && matches(path, PROTECTED)) {
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    to.search = `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(to);
  }
  if (user && matches(path, AUTH_PAGES)) {
    const to = request.nextUrl.clone();
    to.pathname = "/dashboard";
    to.search = "";
    return NextResponse.redirect(to);
  }
  return response;
}
