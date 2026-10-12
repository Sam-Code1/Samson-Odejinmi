import type { Metadata } from "next";
import { AuthForm } from "@/components/forms/AuthForm";
import { forgotPassword } from "@/app/auth-actions";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-h2">Reset your password</h1>
      <p className="mt-3 text-body text-ink-2">Enter your email and we&apos;ll send you a link to choose a new one.</p>
      <div className="mt-10"><AuthForm mode="forgot" action={forgotPassword} /></div>
    </>
  );
}
