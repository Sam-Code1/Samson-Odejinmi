import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ActionForm } from "@/components/forms/ActionForm";
import { Field } from "@/components/forms/Field";
import { updateProfile } from "@/app/student-actions";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser("/profile");
  const supabase = await createClient();
  const { data: p } = await supabase.from("profiles").select("first_name, last_name").eq("id", user.id).maybeSingle();
  return (
    <div className="max-w-xl">
      <h1 className="text-h1">Profile</h1>
      <p className="mt-4 text-body text-ink-2">Signed in as {user.email}.</p>
      <div className="mt-10">
        <ActionForm action={updateProfile} submitLabel="Save changes">
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="First name" name="first_name" defaultValue={p?.first_name ?? ""} autoComplete="given-name" required />
            <Field label="Last name" name="last_name" defaultValue={p?.last_name ?? ""} autoComplete="family-name" required />
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
