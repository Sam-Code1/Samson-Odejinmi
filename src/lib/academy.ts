import { cache } from "react";
import data from "@/content/blender-foundations.json";
import { supabaseConfigured } from "@/lib/supabase/server";
import { contentClient, isPreview } from "@/lib/cms";

export type PublicCourse = {
  id: string; slug: string; title: string; subtitle: string | null; description: string | null; level: string | null; instructor: string | null;
  category: string | null; estimatedDuration: string | null; imageUrl: string | null;
  learningOutcomes: string[]; requirements: string[]; targetAudience: string[]; objectives: string[];
  seoTitle: string | null; seoDescription: string | null;
  modules: { position: number; title: string; lessons: { title: string }[] }[];
  moduleCount: number; lessonCount: number;
  /** "sample" = built-in outline shown only when Supabase isn't connected yet. */
  source: "database" | "sample";
};

const withCounts = (c: Omit<PublicCourse, "moduleCount" | "lessonCount">): PublicCourse => ({
  ...c, moduleCount: c.modules.length, lessonCount: c.modules.reduce((n, m) => n + m.lessons.length, 0),
});

function sample(): PublicCourse {
  return withCounts({
    id: "", slug: data.slug, title: data.title, subtitle: data.shortDescription, description: data.promise, level: data.level, instructor: "Samson Odejinmi",
    category: "3D", estimatedDuration: null, imageUrl: null, learningOutcomes: data.learn, requirements: ["A computer that can run Blender (Blender itself is free)."],
    targetAudience: data.forWho, objectives: [], seoTitle: null, seoDescription: null,
    modules: data.modules.map((m) => ({ position: m.number, title: m.title, lessons: m.lessons.map((l) => ({ title: `${l.number} ${l.title}` })) })),
    source: "sample",
  });
}

type Row = Record<string, unknown>;
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const s = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

/** Published courses only. Drafts appear only in an admin's preview session (draft mode + admin RLS). Archived never. */
export const getPublishedCourses = cache(async (): Promise<PublicCourse[]> => {
  if (!supabaseConfigured) return [sample()];
  try {
    // Cookie-less for visitors so Academy pages can be cached; the admin's own session only in preview.
    const supabase = await contentClient();
    const preview = await isPreview();
    const { data: rows, error } = await supabase.from("courses").select("*").in("status", preview ? ["published", "draft"] : ["published"]).order("created_at");
    if (error || !rows) return [];
    return await Promise.all((rows as Row[]).map(async (r) => {
      const { data: cur } = await supabase.rpc("public_course_curriculum", { p_slug: r.slug as string });
      const modules = Array.isArray(cur) ? (cur as { position: number; title: string; lessons: { title: string }[] }[]) : [];
      return withCounts({
        id: r.id as string, slug: r.slug as string, title: r.title as string, subtitle: s(r.subtitle), description: s(r.description), level: s(r.level), instructor: s(r.instructor),
        category: s(r.category), estimatedDuration: s(r.estimated_duration), imageUrl: s(r.image_url),
        learningOutcomes: arr(r.learning_outcomes), requirements: arr(r.requirements), targetAudience: arr(r.target_audience), objectives: arr(r.objectives),
        seoTitle: s(r.seo_title), seoDescription: s(r.seo_description), modules, source: "database",
      });
    }));
  } catch {
    return [];
  }
});

export async function getPublishedCourse(slug: string) {
  return (await getPublishedCourses()).find((c) => c.slug === slug) ?? null;
}
