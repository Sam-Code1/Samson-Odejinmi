"use client";

import { startTransition, useActionState, useRef, useState, useTransition } from "react";
import { Camera, Trash2 } from "lucide-react";
import { removeAvatar, uploadAvatar, type AvatarState } from "@/app/avatar-actions";
import { Avatar } from "./Avatar";

/** Profile photo: pick → instant local preview → upload (server validates type, signature and size). */
export function AvatarUpload({ current, initials }: { current: string | null; initials: string }) {
  const [state, action, pending] = useActionState<AvatarState, FormData>(uploadAvatar, {});
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [removing, startRemove] = useTransition();
  const [removed, setRemoved] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const shown = preview ?? (removed ? null : current);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setLocalError(null);
    if (!f) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(f.type)) { setLocalError("Please use a JPG, PNG or WebP image."); return; }
    if (f.size > 2 * 1024 * 1024) { setLocalError("That photo is over 2 MB. Please choose a smaller one."); return; }
    setPreview(URL.createObjectURL(f));
    setRemoved(false);
    const fd = new FormData(form.current!);
    startTransition(() => action(fd));
  };

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <Avatar src={shown} initials={initials} size={88} />
      <div className="space-y-3">
        <form ref={form} onSubmit={(e) => e.preventDefault()}>
          <label className="fa-btn fa-btn-secondary cursor-pointer focus-within:ring-2 focus-within:ring-[rgb(var(--focus))]">
            <Camera aria-hidden className="h-4 w-4" />{pending ? "Uploading…" : shown ? "Change photo" : "Upload photo"}
            <input type="file" name="avatar" accept="image/jpeg,image/png,image/webp" onChange={onPick} disabled={pending} className="sr-only" />
          </label>
          {shown && !pending && (
            <button type="button" disabled={removing} onClick={() => startRemove(async () => { const r = await removeAvatar(); if (r.ok) { setRemoved(true); setPreview(null); } })}
              className="fa-btn fa-btn-text ml-3 !text-ink-2 hover:!text-ink"><Trash2 aria-hidden className="h-4 w-4" />{removing ? "Removing…" : "Remove"}</button>
          )}
        </form>
        <p className="text-caption text-ink-3">JPG, PNG or WebP · up to 2 MB · shown in your portal and next to your reviews.</p>
        {(localError || state.error) && <p role="alert" className="text-body-sm text-warm">{localError ?? state.error}</p>}
        {state.ok && !pending && !localError && <p role="status" className="text-body-sm text-success">✓ Photo updated</p>}
      </div>
    </div>
  );
}
