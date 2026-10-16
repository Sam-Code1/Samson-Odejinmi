import type { AdminContext } from "./guard";
import { createServiceClient } from "@/lib/supabase/admin";
import { PROVIDERS } from "@/lib/payments/providers";
import { aiStatus } from "@/lib/ai/provider";

/**
 * System health checks for Admin → System health. Each check makes one cheap authenticated call with a short timeout.
 * Results are only Connected / Degraded / Disconnected plus a plain note. Keys and responses are never shown.
 */
export type HealthState = "connected" | "degraded" | "disconnected";
export type HealthCheck = { id: string; label: string; state: HealthState; note: string; ms?: number };

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T | null; ms: number }> {
  const t = Date.now();
  try { return { value: await fn(), ms: Date.now() - t }; } catch { return { value: null, ms: Date.now() - t }; }
}
const get = (url: string, headers: Record<string, string>) => fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(8_000) });

export async function runHealthChecks(ctx: AdminContext): Promise<HealthCheck[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const service = createServiceClient();

  const checks: Promise<HealthCheck>[] = [
    (async () => {
      const r = await timed(async () => (await ctx.supabase.from("site_settings").select("id").limit(1)).error);
      return { id: "database", label: "Database", ms: r.ms, state: r.value === null && r.ms < 8000 ? (r.ms > 1500 ? "degraded" : "connected") : "disconnected", note: r.value === null ? (r.ms > 1500 ? "Responding slowly" : "Responding") : "Query failed" } as HealthCheck;
    })(),
    (async () => {
      const r = await timed(async () => (await get(`${url}/auth/v1/health`, { apikey: anon })).ok);
      return { id: "auth", label: "Authentication", ms: r.ms, state: r.value ? "connected" : "disconnected", note: r.value ? "Supabase Auth responding" : "Supabase Auth not reachable" };
    })(),
    (async () => {
      if (!service) return { id: "storage", label: "File storage", state: "disconnected", note: "Needs SUPABASE_SERVICE_ROLE_KEY" } as HealthCheck;
      const r = await timed(async () => { const { data, error } = await service.storage.listBuckets(); return error ? null : (data ?? []).map((b) => b.id); });
      const need = ["academy-media", "course-resources", "product-files"];
      const missing = need.filter((b) => !(r.value ?? []).includes(b));
      return { id: "storage", label: "File storage", ms: r.ms, state: !r.value ? "disconnected" : missing.length ? "degraded" : "connected", note: !r.value ? "Storage not reachable" : missing.length ? `Missing bucket(s): ${missing.join(", ")} (run the latest migrations)` : "All buckets present" };
    })(),
    ...(["paystack", "flutterwave"] as const).map(async (id) => {
      const p = PROVIDERS[id];
      if (!p.configured()) return { id, label: p.name, state: "disconnected", note: "Not configured (no secret key set)" } as HealthCheck;
      const r = await timed(() => p.ping());
      return { id, label: p.name, ms: r.ms, state: r.value ? "connected" : "degraded", note: r.value ? `API key accepted · ${p.mode()} mode` : "Key set, but the API didn't accept it or didn't respond" } as HealthCheck;
    }),
    (async () => {
      const key = process.env.RESEND_API_KEY;
      if (!key) return { id: "email", label: "Email (Resend)", state: "disconnected", note: "RESEND_API_KEY not set: no emails are sent" } as HealthCheck;
      const r = await timed(async () => { const res = await get("https://api.resend.com/domains", { Authorization: `Bearer ${key}` }); const b = (await res.json().catch(() => null)) as { name?: string } | null; return res.ok ? "ok" : b?.name === "restricted_api_key" ? "send-only" : "bad"; });
      return { id: "email", label: "Email (Resend)", ms: r.ms, state: r.value === "ok" || r.value === "send-only" ? "connected" : "degraded", note: r.value === "ok" ? "API key accepted" : r.value === "send-only" ? "Sending-only key accepted" : "Key set, but Resend didn't accept it" };
    })(),
    (async () => {
      const s = aiStatus();
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) return { id: "ai", label: `AI (${s.provider})`, state: "disconnected", note: "ANTHROPIC_API_KEY not set: AI tools are off" } as HealthCheck;
      const r = await timed(async () => (await get("https://api.anthropic.com/v1/models?limit=1", { "x-api-key": key, "anthropic-version": "2023-06-01" })).ok);
      return { id: "ai", label: `AI (${s.provider})`, ms: r.ms, state: r.value ? "connected" : "degraded", note: r.value ? `API key accepted · default model ${s.model}` : "Key set, but the API didn't accept it" };
    })(),
    (async () => {
      const { data, error } = await ctx.supabase.from("webhook_events").select("provider, outcome, received_at").gte("received_at", new Date(Date.now() - 30 * 86_400_000).toISOString()).order("received_at", { ascending: false }).limit(500);
      if (error) return { id: "webhooks", label: "Payment webhooks", state: "disconnected", note: "Webhook log needs migration 0009" } as HealthCheck;
      const rows = (data ?? []) as { outcome: string; received_at: string }[];
      const day = Date.now() - 86_400_000;
      const bad = rows.filter((r) => (r.outcome === "rejected" || r.outcome === "failed") && Date.parse(r.received_at) > day).length;
      const ok = rows.find((r) => r.outcome === "processed");
      return { id: "webhooks", label: "Payment webhooks", state: bad ? "degraded" : ok ? "connected" : "disconnected",
        note: bad ? `${bad} rejected or failed in the last 24 hours` : ok ? `Last processed ${new Date(ok.received_at).toUTCString()}` : "No processed webhook in the last 30 days (normal if there were no payments)" } as HealthCheck;
    })(),
    (async () => ({ id: "cron", label: "Scheduled jobs (cron)", state: process.env.CRON_SECRET ? "connected" : "disconnected", note: process.env.CRON_SECRET ? "CRON_SECRET set; Vercel Cron calls /api/cron/marketing" : "CRON_SECRET not set: scheduled emails and automations only run when triggered by hand" }) as HealthCheck)(),
  ];
  return Promise.all(checks);
}
