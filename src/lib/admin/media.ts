import type { AdminContext } from "./guard";
import type { LibraryImage } from "@/components/admin/ImageField";

/** Recent, non-archived images for the "choose from library" pickers. */
export async function getLibraryImages(ctx: AdminContext, limit = 120): Promise<LibraryImage[]> {
  const { data } = await ctx.supabase.from("media_assets").select("public_url, filename, mime_type, archived")
    .not("public_url", "is", null).like("mime_type", "image/%").order("created_at", { ascending: false }).limit(limit);
  return ((data ?? []) as { public_url: string; filename: string; archived?: boolean }[])
    .filter((m) => !m.archived)
    .map((m) => ({ url: m.public_url, filename: m.filename }));
}
