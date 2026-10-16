import { cleanTag } from "./steps";

/**
 * Audience definitions. Presets map 1:1 to fixed SQL in segment_contacts() (migration 0008): no user-written queries.
 * Marketing sends always add "has opted in, not unsubscribed, address not bouncing" on top.
 */
export const PRESETS = {
  all_subscribers: "All subscribers (opted in)",
  all_contacts: "Everyone in the CRM",
  product_buyers: "Bought any product",
  ebook_buyers: "Ebook buyers",
  course_students: "Course students",
  never_purchased: "Never purchased",
  ebook_not_course: "Bought an ebook but not a course",
  completed_course: "Completed a course",
  inactive_students: "Inactive students (30+ days)",
  recent_customers: "Recent customers (30 days)",
  leads: "Leads (no purchase or enrolment)",
  affiliate_referrals: "Referred by an affiliate",
} as const;
export type Preset = keyof typeof PRESETS;

export const LIFECYCLES = { lead: "Lead", customer: "Customer", student: "Student", repeat_customer: "Repeat customer", inactive: "Inactive" } as const;
export type Lifecycle = keyof typeof LIFECYCLES;

export type SegmentDefinition = { preset: Preset; tags_any?: string[]; tags_none?: string[]; lifecycle?: Lifecycle };

const tagList = (v: unknown) => [...new Set(String(v ?? "").split(",").map(cleanTag).filter((t): t is string => !!t))].slice(0, 10);

export function parseDefinition(fd: FormData): { ok: true; def: SegmentDefinition } | { ok: false; error: string } {
  const preset = String(fd.get("preset") ?? "") as Preset;
  if (!(preset in PRESETS)) return { ok: false, error: "Choose who this audience includes." };
  const lifecycle = String(fd.get("lifecycle") ?? "");
  const def: SegmentDefinition = { preset };
  const any = tagList(fd.get("tags_any")), none = tagList(fd.get("tags_none"));
  if (any.length) def.tags_any = any;
  if (none.length) def.tags_none = none;
  if (lifecycle && lifecycle in LIFECYCLES) def.lifecycle = lifecycle as Lifecycle;
  return { ok: true, def };
}

export function describeDefinition(def: Partial<SegmentDefinition> | null | undefined): string {
  if (!def?.preset || !(def.preset in PRESETS)) return "Unknown audience";
  const parts: string[] = [PRESETS[def.preset as Preset]];
  if (def.lifecycle && def.lifecycle in LIFECYCLES) parts.push(`lifecycle: ${LIFECYCLES[def.lifecycle as Lifecycle].toLowerCase()}`);
  if (def.tags_any?.length) parts.push(`tagged ${def.tags_any.join(" or ")}`);
  if (def.tags_none?.length) parts.push(`not tagged ${def.tags_none.join(", ")}`);
  return parts.join(" · ");
}
