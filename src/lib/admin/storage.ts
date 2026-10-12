import type { AdminContext } from "./guard";

const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };
const MAX_IMAGE = 5 * 1024 * 1024;

const FILE_EXT: Record<string, { kind: "pdf" | "zip" | "doc" | "xlsx" | "image" | "other"; mime: string }> = {
  pdf: { kind: "pdf", mime: "application/pdf" }, zip: { kind: "zip", mime: "application/zip" },
  doc: { kind: "doc", mime: "application/msword" }, docx: { kind: "doc", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  xls: { kind: "xlsx", mime: "application/vnd.ms-excel" }, xlsx: { kind: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  csv: { kind: "xlsx", mime: "text/csv" }, pptx: { kind: "other", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
  txt: { kind: "other", mime: "text/plain" }, blend: { kind: "other", mime: "application/octet-stream" },
  png: { kind: "image", mime: "image/png" }, jpg: { kind: "image", mime: "image/jpeg" }, jpeg: { kind: "image", mime: "image/jpeg" }, webp: { kind: "image", mime: "image/webp" },
};
export const MAX_FILE = 25 * 1024 * 1024;

const safeName = (n: string) => n.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-80) || "file";
export const isFile = (v: FormDataEntryValue | null): v is File => typeof v === "object" && v !== null && "size" in v && (v as File).size > 0;

export type UploadResult = { ok: true; url: string; path: string } | { ok: false; error: string };

export type ImageKind = "image" | "thumbnail" | "lesson_image" | "site_image" | "portfolio" | "og_image" | "logo";
export const IMAGE_KINDS: Record<ImageKind, string> = {
  site_image: "Website image", portfolio: "Portfolio image", og_image: "Social share image", logo: "Logo / icon",
  image: "Course image", thumbnail: "Course thumbnail", lesson_image: "Lesson image",
};

/**
 * Public images (website, portfolio, course covers, thumbnails, lesson images). Stored in the public academy-media
 * bucket. SVG is rejected on purpose (script risk). Large course videos are never uploaded here (they stay on YouTube).
 */
export async function uploadImage(ctx: AdminContext, file: File, kind: ImageKind, link?: { course_id?: string; lesson_id?: string; alt_text?: string }): Promise<UploadResult> {
  const ext = IMAGE_TYPES[file.type];
  if (!ext) return { ok: false, error: "Images must be PNG, JPG, WebP, GIF or AVIF." };
  if (file.size > MAX_IMAGE) return { ok: false, error: "Images must be 5 MB or smaller." };
  const path = `${kind}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error } = await ctx.supabase.storage.from("academy-media").upload(path, file, { contentType: file.type, upsert: false });
  if (error) return { ok: false, error: "The image couldn't be uploaded. Check that the storage buckets exist (run migration 0002)." };
  const url = ctx.supabase.storage.from("academy-media").getPublicUrl(path).data.publicUrl;
  const { error: me } = await ctx.supabase.from("media_assets").insert({ bucket: "academy-media", path, public_url: url, filename: file.name.slice(0, 200), mime_type: file.type, size_bytes: file.size, kind, created_by: ctx.user.id, ...link });
  if (me) console.error("[media] library record not saved:", me.code);
  return { ok: true, url, path };
}

/**
 * Resolves an ImageField from a form: a new upload wins, then a library pick, then "remove", otherwise keep current.
 * Field names: `${name}_file`, `${name}_library`, `${name}_remove`. Returns undefined when nothing changed.
 */
export async function resolveImageField(ctx: AdminContext, fd: FormData, name: string, kind: ImageKind): Promise<{ ok: true; url: string | null | undefined } | { ok: false; error: string }> {
  const file = fd.get(`${name}_file`);
  if (isFile(file)) {
    const up = await uploadImage(ctx, file, kind);
    return up.ok ? { ok: true, url: up.url } : { ok: false, error: up.error };
  }
  const picked = String(fd.get(`${name}_library`) ?? "").trim();
  if (picked) {
    // Only images that are actually in the media library can be picked.
    const { data } = await ctx.supabase.from("media_assets").select("public_url").eq("public_url", picked).limit(1).maybeSingle();
    if (!data) return { ok: false, error: "That image isn't in the media library." };
    return { ok: true, url: picked };
  }
  const v = fd.get(`${name}_remove`);
  if (v === "on" || v === "true") return { ok: true, url: null };
  return { ok: true, url: undefined };
}

/** Private downloadable files. Served to enrolled students via short-lived signed URLs only. */
export async function uploadResourceFile(ctx: AdminContext, file: File, courseId: string) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const meta = FILE_EXT[ext];
  if (!meta) return { ok: false as const, error: "That file type isn't allowed. Use PDF, ZIP, Word, Excel, CSV, PowerPoint, text, .blend or a PNG/JPG/WebP image." };
  if (file.size > MAX_FILE) return { ok: false as const, error: "Files must be 25 MB or smaller." };
  const path = `${courseId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error } = await ctx.supabase.storage.from("course-resources").upload(path, file, { contentType: meta.mime, upsert: false });
  if (error) return { ok: false as const, error: "The file couldn't be uploaded. Check that the storage buckets exist (run migration 0002)." };
  return { ok: true as const, path, kind: meta.kind, mime: meta.mime, size: file.size };
}
