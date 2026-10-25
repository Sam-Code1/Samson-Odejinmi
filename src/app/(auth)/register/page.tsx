import type { Metadata } from "next";
import { AuthForm } from "@/components/forms/AuthForm";
import { register } from "@/app/auth-actions";

export const metadata: Metadata = { title: "Create an account", robots: { index: false } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const affiliate = next === "/affiliate";
  return (
    <>
      <h1 className="text-h2">Create an account</h1>
      <p className="mt-3 text-body text-ink-2">{affiliate
        ? "A free account is all you need to join the affiliate programme. You don't have to buy a course or be a student."
        : "An account lets you follow your courses and keep your progress. It doesn't give course access by itself."}</p>
      <div className="mt-10"><AuthForm mode="register" action={register} next={next} /></div>
    </>
  );
}
