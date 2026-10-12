import type { Metadata } from "next";
import { AuthForm } from "@/components/forms/AuthForm";
import { login } from "@/app/auth-actions";
import { supabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Log in", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <>
      <h1 className="text-h2">Log in</h1>
      <p className="mt-3 text-body text-ink-2">Welcome back. Pick up where you left off.</p>
      {error === "link" && <p role="alert" className="mt-6 border-l-2 border-blue pl-4 text-body-sm">That link has expired or was already used. Try logging in, or request a new link.</p>}
      {!supabaseConfigured && <p role="status" className="mt-6 border-l-2 border-violet pl-4 text-body-sm text-ink-2">Accounts aren&apos;t connected yet. Add your Supabase keys to .env.local to switch them on.</p>}
      <div className="mt-10"><AuthForm mode="login" action={login} next={next} /></div>
    </>
  );
}
