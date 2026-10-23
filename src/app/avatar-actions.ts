"use server";

import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Profile photo upload (Settings). The signed-in user's own session uploads into THEIR folder of the public "avatars"
 * bucket (storage policies, migration 0015 allow nothing else). Checked here first: JPEG/PNG/WebP only (by the file's
 * real signature, not just its name), at most 2 MB. The previous photo is deleted.
 */
export type AvatarState = { ok?: boolean; error?: string };
const MAX = 2 * 1024 * 1024;

function sniff(b: Uint8Array): "jpg" | "png" | "webp" | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  return null;
}
const MIME = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

export async function uploadAvatar(_: AvatarState, fd: FormData): Promise<AvatarState> {
  const user = await getUser();
  if (!user) return { error: "Please sign in again." };
  const file = fd.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo first." };
  if (file.size > MAX) return { error: "That photo is over 2 MB. Please choose a smaller one." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = sniff(bytes);
  if (!ext) return { error: "Please use a JPG, PNG or WebP image." };

  const supabase = await createClient();
  const { data: prev } = await supabase.from("profiles").select("avatar_path").eq("id", user.id).maybeSingle();
  const path = `${user.id}/avatar-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage.from("avatars").upload(path, bytes, { contentType: MIME[ext], upsert: false, cacheControl: "31536000" });
  if (upErr) { console.error("[avatar] upload:", upErr.message); return { error: "We couldn't upload that photo. Please try again." }; }
  const { data: ok, error } = await supabase.rpc("set_my_avatar", { p_path: path });
  if (error || ok !== true) {
    await supabase.storage.from("avatars").remove([path]);
    return { error: error?.code === "PGRST202" ? "Profile photos need migration 0015." : "We couldn't save your photo. Please try again." };
  }
  const old = prev?.avatar_path as string | null | undefined;
  if (old && old !== path) await supabase.storage.from("avatars").remove([old]);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeAvatar(): Promise<AvatarState> {
  const user = await getUser();
  if (!user) return { error: "Please sign in again." };
  const supabase = await createClient();
  const { data: prev } = await supabase.from("profiles").select("avatar_path").eq("id", user.id).maybeSingle();
  const { error } = await supabase.rpc("set_my_avatar", { p_path: null });
  if (error) return { error: "We couldn't remove your photo. Please try again." };
  if (prev?.avatar_path) await supabase.storage.from("avatars").remove([prev.avatar_path as string]);
  revalidatePath("/", "layout");
  return { ok: true };
}
