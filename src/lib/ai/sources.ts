import type { AdminContext } from "@/lib/admin/guard";

/**
 * Builds the learning material the AI is allowed to use. Everything is loaded server-side with the admin's session
 * (RLS applies); nothing comes from the browser except which sources to include.
 *
 * Cost control: each source and the total are capped. When material is cut, the result says so explicitly
 * (never silently), so the admin knows the questions only cover part of it.
 */
export const MAX_SOURCE_CHARS = 60_000;
const MAX_PER_RESOURCE = 30_000;
const MAX_RESOURCE_BYTES = 15 * 1024 * 1024;
const MAX_PDF_PAGES = 60;

export type SourceKey = "content" | "transcript" | "notes" | "resources";
export type SourcePart = { label: string; ref: string; text: string };
export type BuiltSource = { parts: SourcePart[]; totalChars: number; notes: string[]; lesson: { id: string; title: string; course_id: string; module_id: string } };

const clean = (s: string) => s.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

async function resourceText(ctx: AdminContext, r: { title: string; file_path: string | null; mime_type: string | null; kind: string }): Promise<{ text: string; pages?: number } | { error: string }> {
  if (!r.file_path) return { error: `“${r.title}” is a link, not a file, so it can't be read.` };
  const isPdf = r.kind === "pdf" || r.mime_type === "application/pdf";
  const isText = r.mime_type === "text/plain" || r.mime_type === "text/csv";
  if (!isPdf && !isText) return { error: `“${r.title}” isn't a PDF or text file, so it was skipped.` };
  const { data, error } = await ctx.supabase.storage.from("course-resources").download(r.file_path);
  if (error || !data) return { error: `“${r.title}” couldn't be downloaded from storage.` };
  if (data.size > MAX_RESOURCE_BYTES) return { error: `“${r.title}” is larger than 15 MB, so it was skipped.` };
  const buf = new Uint8Array(await data.arrayBuffer());
  if (isText) return { text: new TextDecoder().decode(buf) };
  try {
    const { extractText } = await import("unpdf");
    const { totalPages, text } = await extractText(buf, { mergePages: false });
    const pages = text.slice(0, MAX_PDF_PAGES).map((t, i) => `[Page ${i + 1}]\n${t}`);
    return { text: pages.join("\n\n"), pages: totalPages };
  } catch {
    return { error: `“${r.title}” couldn't be read as a PDF (it may be scanned images or protected).` };
  }
}

export async function buildLessonSource(ctx: AdminContext, lessonId: string, keys: SourceKey[], resourceIds: string[]): Promise<BuiltSource | { error: string }> {
  const [{ data: lesson }, { data: src }] = await Promise.all([
    ctx.supabase.from("lessons").select("id, title, summary, content_md, course_id, module_id").eq("id", lessonId).maybeSingle(),
    ctx.supabase.from("lesson_sources").select("transcript, notes").eq("lesson_id", lessonId).maybeSingle(),
  ]);
  if (!lesson) return { error: "That lesson wasn't found." };
  const parts: SourcePart[] = [];
  const notes: string[] = [];
  const add = (label: string, ref: string, text: string | null | undefined, cap = MAX_SOURCE_CHARS) => {
    const t = clean(text ?? "");
    if (!t) { notes.push(`${label} is empty, so it wasn't used.`); return; }
    if (t.length > cap) notes.push(`${label} is ${t.length.toLocaleString()} characters; only the first ${cap.toLocaleString()} were used.`);
    parts.push({ label, ref, text: t.slice(0, cap) });
  };

  if (keys.includes("content")) add("Lesson text", "lesson text", [lesson.summary, lesson.content_md].filter(Boolean).join("\n\n"));
  if (keys.includes("transcript")) add("Lesson transcript", "transcript", src?.transcript as string | null);
  if (keys.includes("notes")) add("Lesson notes", "notes", src?.notes as string | null);

  if (keys.includes("resources") && resourceIds.length) {
    // Only resources that belong to this lesson's course can be used.
    const { data: rs } = await ctx.supabase.from("lesson_resources").select("id, title, file_path, mime_type, kind").in("id", resourceIds.slice(0, 5)).eq("course_id", lesson.course_id);
    for (const r of (rs ?? []) as { id: string; title: string; file_path: string | null; mime_type: string | null; kind: string }[]) {
      const res = await resourceText(ctx, r);
      if ("error" in res) notes.push(res.error);
      else {
        if (res.pages && res.pages > MAX_PDF_PAGES) notes.push(`“${r.title}” has ${res.pages} pages; only the first ${MAX_PDF_PAGES} were read.`);
        add(`Resource: ${r.title}`, `resource “${r.title}”`, res.text, MAX_PER_RESOURCE);
      }
    }
  }

  // Enforce the overall budget across all parts, in the order selected.
  let budget = MAX_SOURCE_CHARS;
  const capped: SourcePart[] = [];
  for (const p of parts) {
    if (budget <= 0) { notes.push(`${p.label} wasn't used: the material limit (${MAX_SOURCE_CHARS.toLocaleString()} characters) was reached.`); continue; }
    if (p.text.length > budget) notes.push(`${p.label} was shortened to fit the material limit.`);
    capped.push({ ...p, text: p.text.slice(0, budget) });
    budget -= Math.min(p.text.length, budget);
  }
  return {
    parts: capped, notes, totalChars: capped.reduce((n, p) => n + p.text.length, 0),
    lesson: { id: lesson.id as string, title: lesson.title as string, course_id: lesson.course_id as string, module_id: lesson.module_id as string },
  };
}

/** Source material is wrapped as data. The model is told never to follow instructions found inside it. */
export function renderSource(parts: SourcePart[]): string {
  const safe = (s: string) => s.replace(/<\/?source/gi, (m) => m.replace("<", "‹"));
  return parts.map((p) => `<source label="${p.label.replace(/"/g, "'")}" ref="${p.ref.replace(/"/g, "'")}">\n${safe(p.text)}\n</source>`).join("\n\n");
}
