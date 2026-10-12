import type { Metadata } from "next";
import { AuthForm } from "@/components/forms/AuthForm";
import { StateMessage } from "@/components/ui/States";
import { resetPassword } from "@/app/auth-actions";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default async function ResetPasswordPage() {
  const user = await getUser();
  if (!user) {
    return <StateMessage compact title="This reset link has expired" body="Reset links work once and for a short time. Request a new one to continue." action={{ href: "/forgot-password", label: "Request a new link" }} />;
  }
  return (
    <>
      <h1 className="text-h2">Choose a new password</h1>
      <p className="mt-3 text-body text-ink-2">Use at least 8 characters.</p>
      <div className="mt-10"><AuthForm mode="reset" action={resetPassword} /></div>
    </>
  );
}
