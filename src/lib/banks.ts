/**
 * Nigerian banks and account-name verification, via Paystack (server-side only: the secret key never reaches the
 * browser). The bank list comes from Paystack, so it stays current and the codes are always the right ones.
 */
const API = "https://api.paystack.co";

export type Bank = { name: string; code: string };
export type Resolved = { ok: true; name: string } | { ok: false; reason: "invalid" | "unavailable" };

/** Every bank Paystack supports in Nigeria (cached for a day). Empty when Paystack isn't configured or can't be reached. */
export async function getBanks(): Promise<Bank[]> {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) return [];
  try {
    const res = await fetch(`${API}/bank?country=nigeria&perPage=200&use_cursor=false`, {
      headers: { Authorization: `Bearer ${key}` }, next: { revalidate: 86_400 }, signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { data?: { name?: unknown; code?: unknown; active?: unknown; is_deleted?: unknown }[] };
    const seen = new Set<string>();
    const banks: Bank[] = [];
    for (const b of body.data ?? []) {
      if (typeof b.name !== "string" || typeof b.code !== "string" || b.active === false || b.is_deleted === true) continue;
      const k = `${b.code}:${b.name}`;
      if (seen.has(k)) continue;
      seen.add(k);
      banks.push({ name: b.name.trim(), code: b.code.trim() });
    }
    return banks.sort((a, c) => a.name.localeCompare(c.name));
  } catch {
    return [];
  }
}

/** Asks the bank who owns this account. "invalid" = the bank says no such account; "unavailable" = we couldn't check. */
export async function resolveAccount(bankCode: string, accountNumber: string): Promise<Resolved> {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key || !/^[0-9A-Za-z]{2,12}$/.test(bankCode) || !/^[0-9]{10}$/.test(accountNumber)) return { ok: false, reason: key ? "invalid" : "unavailable" };
  try {
    const res = await fetch(`${API}/bank/resolve?account_number=${accountNumber}&bank_code=${encodeURIComponent(bankCode)}`, {
      headers: { Authorization: `Bearer ${key}` }, cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => null)) as { status?: boolean; data?: { account_name?: unknown } } | null;
    const name = body?.data?.account_name;
    if (res.ok && body?.status && typeof name === "string" && name.trim()) return { ok: true, name: name.trim().slice(0, 160) };
    // 422 = the bank doesn't recognise the account; anything else (rate limit, test-mode limits, outage) is "couldn't check".
    return { ok: false, reason: res.status === 422 ? "invalid" : "unavailable" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}
