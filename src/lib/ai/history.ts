/** Pure helpers for chat input (no server imports, so they can be unit-tested). */

/** Validates and trims a client-sent conversation: only user/assistant turns, bounded length and count. */
export function cleanHistory(raw: unknown, maxChars: number, maxTurns: number): { role: "user" | "assistant"; content: string }[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const turns = raw.slice(-maxTurns * 2).map((t) => {
    const r = (t as { role?: unknown })?.role, c = (t as { content?: unknown })?.content;
    if ((r !== "user" && r !== "assistant") || typeof c !== "string") return null;
    const content = c.trim().slice(0, r === "user" ? maxChars : 4000);
    return content ? { role: r as "user" | "assistant", content } : null;
  });
  if (turns.some((t) => t === null)) return null;
  const list = turns as { role: "user" | "assistant"; content: string }[];
  // The API needs the conversation to start with the user and end with the user's new message.
  while (list.length && list[0].role !== "user") list.shift();
  if (!list.length || list[list.length - 1].role !== "user") return null;
  return list;
}
