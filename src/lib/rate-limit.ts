import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createServiceClient } from "@/lib/supabase/admin";

/** Salted hash of the visitor's IP: lets us rate-limit public forms without storing IP addresses. */
export async function visitorHash(): Promise<string> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
  const salt = process.env.AI_RATE_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "fola";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

/**
 * Allows at most `max` events of `kind` per `windowMinutes` for this key, and records this one when allowed.
 * Without the service key it fails closed for public forms (returns false) so nothing unthrottled is accepted.
 */
export async function allowRate(kind: string, key: string, max: number, windowMinutes: number): Promise<boolean> {
  const service = createServiceClient();
  if (!service) return false;
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { count, error } = await service.from("rate_events").select("id", { count: "exact", head: true }).eq("kind", kind).eq("key_hash", key).gte("created_at", since);
  if (error) return false;
  if ((count ?? 0) >= max) return false;
  await service.from("rate_events").insert({ kind, key_hash: key });
  return true;
}
