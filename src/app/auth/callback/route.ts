import { NextResponse, type NextRequest } from "next/server";
import { createClient, supabaseConfigured } from "@/lib/supabase/server";
import { safeNext } from "@/lib/utils";
import { sendEmail, templates } from "@/lib/email";

/** Exchanges the emailed code for a session (sign-up confirmation and password reset). */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  if (code && supabaseConfigured) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Welcome email once the address is confirmed (sign-up links go to /dashboard; reset links don't).
      // Only for accounts created in the last day, so old accounts re-confirming aren't re-welcomed. Best-effort.
      const u = data.user;
      if (next === "/dashboard" && u?.email && u.email_confirmed_at && Date.now() - +new Date(u.created_at) < 86_400_000) {
        await sendEmail({ to: u.email, ...templates.welcome(String(u.user_metadata?.first_name ?? "")) });
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}
