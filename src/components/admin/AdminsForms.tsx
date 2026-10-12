"use client";

import { useState } from "react";
import { addAdmin, changeAdminRole, removeAdmin, transferOwnership } from "@/app/admin/actions/admins";
import { AdminForm } from "./AdminForm";
import { CheckboxInput, SelectInput, TextInput } from "./FormFields";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/admin/roles";

const ASSIGNABLE = ["academy_admin", "content_manager", "support", "super_admin"] as const;
const roleOptions = ASSIGNABLE.map((r) => ({ value: r, label: `${ROLE_LABELS[r]} — ${ROLE_DESCRIPTIONS[r]}` }));

export function AddAdminForm({ inviteAvailable }: { inviteAvailable: boolean }) {
  const [role, setRole] = useState<string>("academy_admin");
  return (
    <AdminForm action={addAdmin} submitLabel="Add admin" stickyBar={false}>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput label="Email" name="email" type="email" required autoComplete="off" hint="Their existing account email. Students who become admins keep their student access." />
        <SelectInput label="Role" name="role" value={role} onChange={(e) => setRole(e.target.value)} options={roleOptions} />
        {inviteAvailable
          ? <CheckboxInput label="Send an invitation if they don't have an account yet" name="invite" hint="They'll get an email to set a password." className="sm:col-span-2" />
          : <p className="text-caption text-ink-3 sm:col-span-2">Invitations need SUPABASE_SERVICE_ROLE_KEY on the server. Until then, ask the person to register first.</p>}
        {role === "super_admin" && <TextInput label="Your password (to confirm)" name="password" type="password" required autoComplete="current-password" hint="Granting Super Admin is a sensitive change." />}
      </div>
    </AdminForm>
  );
}

export function ChangeRoleForm({ userId, current }: { userId: string; current: string }) {
  const [role, setRole] = useState<string>(current);
  return (
    <AdminForm action={changeAdminRole} submitLabel="Change role" stickyBar={false}>
      <input type="hidden" name="userId" value={userId} />
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr] sm:items-end">
        <SelectInput label="Role" name="role" value={role} onChange={(e) => setRole(e.target.value)} options={ASSIGNABLE.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} />
        {role === "super_admin" && role !== current && <TextInput label="Your password (to confirm)" name="password" type="password" required autoComplete="current-password" />}
      </div>
    </AdminForm>
  );
}

export function RemoveAdminForm({ userId }: { userId: string }) {
  return (
    <AdminForm action={removeAdmin} submitLabel="Remove admin access" stickyBar={false}>
      <input type="hidden" name="userId" value={userId} />
      <TextInput label="Your password (to confirm)" name="password" type="password" required autoComplete="current-password" hint="Removes admin access only. Their account and any student data stay." />
    </AdminForm>
  );
}

export function TransferOwnershipForm({ candidates }: { candidates: { id: string; label: string }[] }) {
  if (!candidates.length) return <p className="text-body-sm text-ink-3">Add another active admin first. Ownership can only go to an active admin.</p>;
  return (
    <AdminForm action={transferOwnership} submitLabel="Transfer ownership" stickyBar={false}>
      <div className="grid gap-5 sm:grid-cols-3">
        <SelectInput label="New owner" name="userId" options={[{ value: "", label: "Choose an admin…" }, ...candidates.map((c) => ({ value: c.id, label: c.label }))]} />
        <TextInput label="Type TRANSFER" name="confirm_text" required autoComplete="off" />
        <TextInput label="Your password" name="password" type="password" required autoComplete="current-password" />
      </div>
      <p className="text-caption text-ink-3">There is always exactly one Owner. You&apos;ll become a Super Admin.</p>
    </AdminForm>
  );
}
