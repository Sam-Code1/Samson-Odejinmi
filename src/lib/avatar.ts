/** Public URL of a profile photo stored in the "avatars" bucket (migration 0015). Null when there's no photo. */
export function avatarUrl(path: string | null | undefined): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!path || !base || !/^[0-9a-f-]{36}\/avatar-[0-9a-z]{6,40}\.(jpg|png|webp)$/.test(path)) return null;
  return `${base}/storage/v1/object/public/avatars/${path}`;
}

/** Initials for the fallback avatar ("Ada Okafor" → "AO"). */
export function initials(first?: string | null, last?: string | null, email?: string | null) {
  const a = (first ?? "").trim()[0] ?? "", b = (last ?? "").trim()[0] ?? "";
  return (a + b || (email ?? "?")[0] || "?").toUpperCase();
}
