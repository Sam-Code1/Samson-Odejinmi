import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runMarketingJobs } from "@/lib/marketing/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Marketing jobs: scheduled campaigns, abandoned checkouts, automations, the email queue.
 * Called by Vercel Cron (vercel.json) or any external scheduler with:  Authorization: Bearer <CRON_SECRET>
 * Without CRON_SECRET the route is disabled.
 */
function authorised(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) return new NextResponse("Unauthorized", { status: 401 });
  const summary = await runMarketingJobs();
  return NextResponse.json(summary, { status: summary.ok ? 200 : 503 });
}
