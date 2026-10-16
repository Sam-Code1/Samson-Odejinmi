/**
 * Pure helpers for the showcase features (intro reveal, hero backdrop word, playground game, WhatsApp).
 * Used both when saving in Admin (validation) and when rendering (so bad stored values can never break a page).
 */

/** Removes the *accent* markers from a title, for places that need plain text (metadata, alt text, labels). */
export function plainTitle(text: string): string {
  return text.replace(/\*([^*]+)\*/g, "$1");
}

/** Intro reveal words: one per line, up to 3, each up to 14 characters. Empty list = intro off. */
export function introWords(v: unknown): string[] {
  if (typeof v !== "string") return [];
  return v.split(/\r?\n/).map((w) => w.trim()).filter(Boolean).slice(0, 3).map((w) => w.slice(0, 14));
}

/** Giant word behind the cut-out portrait: one word, up to 12 characters. */
export function backdropWord(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const w = v.trim().split(/\s+/)[0] ?? "";
  return w ? w.slice(0, 12) : null;
}

/** Characters the game's block font can draw. */
export const GAME_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 !?.-";

/** Game text: up to 2 lines of 7 drawable characters, upper-cased. Returns null when nothing drawable is left. */
export function gameLines(v: unknown): string[] | null {
  if (typeof v !== "string") return null;
  const lines = v
    .toUpperCase()
    .split(/\r?\n/)
    .map((l) => [...l].filter((c) => GAME_CHARS.includes(c)).join("").trim().slice(0, 7))
    .filter(Boolean)
    .slice(0, 2);
  return lines.length ? lines : null;
}

/** wa.me link for a stored number (digits only, international). */
export function whatsappHref(number: string | null, message?: string | null): string | null {
  if (!number || !/^[1-9]\d{7,14}$/.test(number)) return null;
  return `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}
