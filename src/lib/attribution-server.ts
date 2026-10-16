import { cookies } from "next/headers";
import { ATTR_COOKIE, REF_COOKIE, cleanRefCode, parseAttribution, type Attribution } from "./attribution";

/** The visitor's referral code and UTM attribution, read from our own httpOnly cookies (set by the middleware). */
export async function readAttribution(): Promise<{ ref: string | null; attribution: Attribution }> {
  const jar = await cookies();
  return {
    ref: cleanRefCode(jar.get(REF_COOKIE)?.value) ?? null,
    attribution: parseAttribution(jar.get(ATTR_COOKIE)?.value) ?? {},
  };
}
