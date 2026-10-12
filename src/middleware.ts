import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/dashboard/:path*", "/courses/:path*", "/profile/:path*", "/settings/:path*", "/learn/:path*", "/admin/:path*", "/login", "/register", "/forgot-password"],
};
