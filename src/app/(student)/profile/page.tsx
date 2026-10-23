import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { Avatar } from "@/components/student/Avatar";
import { updateProfile } from "@/app/student-actions";
import { avatarUrl, initials } from "@/lib/avatar";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser("/profile");
  const supabase = await createClient();
  let { data: p } = await supabase.from("profiles").select("first_name, last_name, avatar_path").eq("id", user.id).maybeSingle();
  if (!p) ({ data: p } = await supabase.from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle() as unknown as { data: typeof p });
  const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ");
  return (
    <div className="max-w-2xl space-y-10">
      <header className="flex items-center gap-5">
        <Avatar src={avatarUrl((p as { avatar_path?: string | null } | null)?.avatar_path)} initials={initials(p?.first_name, p?.last_name, user.email)} size={72} />
        <div className="min-w-0">
          <p className="fa-label">Profile</p>
          <h1 className="mt-2 truncate text-h2">{name || "Your profile"}</h1>
          <p className="mt-1 truncate text-caption text-ink-3">{user.email}</p>
        </div>
      </header>
      <section className="fa-card p-5 sm:p-7" aria-labelledby="details">
        <h2 id="details" className="text-h4">Your details</h2>
        <p className="mt-1 text-body-sm text-ink-2">Your name appears on your certificates.</p>
        <div className="mt-6">
          <ActionForm action={updateProfile} submitLabel="Save changes">
            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="First name" name="first_name" defaultValue={p?.first_name ?? ""} autoComplete="given-name" required />
              <Field label="Last name" name="last_name" defaultValue={p?.last_name ?? ""} autoComplete="family-name" required />
            </div>
          </ActionForm>
        </div>
      </section>
      <p className="text-body-sm text-ink-2">Change your photo, theme, emails or password in <Link href="/settings" className="text-blue underline underline-offset-4">Settings</Link>.</p>
    </div>
  );
}
