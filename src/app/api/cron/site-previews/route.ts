import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/admin";
import type { AdminContext } from "@/lib/admin/guard";
import { revalidateSite } from "@/lib/admin/activity";
import { PROJECT_SITE_COLS, refreshProjectSite, type ProjectSiteRow } from "@/lib/admin/site-refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A capture takes 20–50 seconds; two run side by side (60 s is the safe limit on every Vercel plan).
export const maxDuration = 60;

/**
 * Daily: keeps website projects in step with their live sites. Re-captures the projects checked longest ago (a few
 * per run, in parallel); a site that hasn't visibly changed costs a capture but no uploads. Projects with
 * "Keep in sync" turned off are skipped. Called by Vercel Cron (vercel.json) with Authorization: Bearer <CRON_SECRET>.
 * Needs SUPABASE_SERVICE_ROLE_KEY (server-only) to write; without CRON_SECRET the route is disabled.
 */
const PER_RUN = 2;
const MIN_AGE_MS = 20 * 60 * 60 * 1000;

function authorised(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) return new NextResponse("Unauthorized", { status: 401 });
  const service = createServiceClient();
  if (!service) return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 503 });
  // A system context: the service role (RLS bypassed, server-only). Uploads are recorded without a person.
  const ctx = { supabase: service, user: { id: "" }, role: "owner", can: () => true } as unknown as AdminContext;

  const { data, error } = await service.from("portfolio_projects").select(PROJECT_SITE_COLS).not("site_preview", "is", null).neq("status", "archived").limit(200);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 503 });
  const now = Date.now();
  const due = ((data ?? []) as unknown as ProjectSiteRow[])
    .filter((p) => p.site_preview && p.site_preview.autoRefresh !== false)
    .map((p) => ({ p, at: Date.parse(p.site_preview?.checkedAt ?? p.site_preview?.fetchedAt ?? "") || 0 }))
    .filter((x) => now - x.at >= MIN_AGE_MS)
    .sort((a, b) => a.at - b.at)
    .slice(0, PER_RUN);

  const results = await Promise.all(due.map(async ({ p }) => {
    const r = await refreshProjectSite(ctx, p);
    return { slug: p.slug, ...(r.ok ? { changed: r.changed, embeddable: r.embeddable } : { error: r.error }) };
  }));
  if (results.some((r) => "changed" in r && r.changed)) revalidateSite();
  return NextResponse.json({ ok: true, checked: results.length, results });
}
