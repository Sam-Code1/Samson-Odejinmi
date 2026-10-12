/**
 * next/image only optimises local files and Supabase public storage (see next.config.mjs). Any other https image an
 * admin references is rendered without optimisation instead of crashing the page.
 */
const supabaseHost = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname; } catch { return null; }
})();

export function canOptimize(src: string): boolean {
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  try {
    const u = new URL(src);
    return u.protocol === "https:" && u.hostname === supabaseHost && u.pathname.startsWith("/storage/v1/object/public/");
  } catch {
    return false;
  }
}

/** Only same-site paths and https URLs are ever rendered as image sources. */
export function safeImageSrc(src: string | null | undefined): string | null {
  if (!src) return null;
  if (src.startsWith("/") && !src.startsWith("//")) return src;
  try { return new URL(src).protocol === "https:" ? src : null; } catch { return null; }
}
