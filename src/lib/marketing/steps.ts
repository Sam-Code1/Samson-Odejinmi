/**
 * Automation steps. Pure validation shared by the admin editor and the engine, so a stored automation is always one
 * the engine can run. Steps execute strictly in order; a condition can only skip FORWARD, and there are at most 20
 * steps, so an automation can never loop.
 */
export const TRIGGERS = {
  user_registered: "Someone creates an account",
  product_purchased: "A product is purchased (any)",
  ebook_purchased: "An ebook is purchased",
  course_enrolled: "Someone is enrolled in a course",
  course_completed: "Someone completes a course",
  coupon_used: "A coupon is used",
  checkout_abandoned: "A checkout is started but not paid (after 2 hours)",
} as const;
export type Trigger = keyof typeof TRIGGERS;
export const isTrigger = (v: unknown): v is Trigger => typeof v === "string" && v in TRIGGERS;

export const CONDITIONS = {
  has_tag: "Has tag",
  consented: "Has opted in to marketing email",
  purchased_any: "Has made any purchase",
  owns_product: "Owns product",
  enrolled_course: "Is enrolled in course",
} as const;
export type ConditionCheck = keyof typeof CONDITIONS;

export type Step =
  | { type: "send_email"; subject: string; body: string }
  | { type: "add_tag"; tag: string }
  | { type: "remove_tag"; tag: string }
  | { type: "wait"; hours: number }
  | { type: "condition"; check: ConditionCheck; value?: string; negate?: boolean; skip: number };

export const MAX_STEPS = 20;
export const MAX_WAIT_HOURS = 24 * 90;
const TAG = /^[a-z0-9][a-z0-9-]{0,39}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function cleanTag(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/^-+/, "").slice(0, 40);
  return TAG.test(t) ? t : null;
}

/** Returns the cleaned steps, or the first problem found (with its 1-based position). */
export function validateSteps(raw: unknown): { ok: true; steps: Step[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "Steps must be a list." };
  if (raw.length === 0) return { ok: false, error: "Add at least one step." };
  if (raw.length > MAX_STEPS) return { ok: false, error: `Use ${MAX_STEPS} steps or fewer.` };
  const steps: Step[] = [];
  for (let i = 0; i < raw.length; i++) {
    const s = raw[i] as Record<string, unknown>;
    const at = `Step ${i + 1}:`;
    if (!s || typeof s !== "object") return { ok: false, error: `${at} invalid step.` };
    switch (s.type) {
      case "send_email": {
        const subject = typeof s.subject === "string" ? s.subject.trim().slice(0, 160) : "";
        const body = typeof s.body === "string" ? s.body.trim().slice(0, 10000) : "";
        if (!subject) return { ok: false, error: `${at} the email needs a subject.` };
        if (!body) return { ok: false, error: `${at} the email needs a message.` };
        steps.push({ type: "send_email", subject, body });
        break;
      }
      case "add_tag":
      case "remove_tag": {
        const tag = cleanTag(s.tag);
        if (!tag) return { ok: false, error: `${at} enter a tag (letters, numbers and dashes).` };
        steps.push({ type: s.type, tag });
        break;
      }
      case "wait": {
        const hours = Number(s.hours);
        if (!Number.isInteger(hours) || hours < 1 || hours > MAX_WAIT_HOURS) return { ok: false, error: `${at} wait between 1 hour and 90 days.` };
        steps.push({ type: "wait", hours });
        break;
      }
      case "condition": {
        const check = s.check as ConditionCheck;
        if (!(typeof check === "string" && check in CONDITIONS)) return { ok: false, error: `${at} choose what to check.` };
        let value: string | undefined;
        if (check === "has_tag") { value = cleanTag(s.value) ?? undefined; if (!value) return { ok: false, error: `${at} enter the tag to check.` }; }
        if (check === "owns_product" || check === "enrolled_course") {
          value = typeof s.value === "string" && UUID.test(s.value) ? s.value : undefined;
          if (!value) return { ok: false, error: `${at} choose the ${check === "owns_product" ? "product" : "course"}.` };
        }
        const skip = Number(s.skip);
        const remaining = raw.length - i - 1;
        if (!Number.isInteger(skip) || skip < 0 || skip > remaining) return { ok: false, error: `${at} "if not" can skip between 0 and ${remaining} following step(s) (0 = stop here).` };
        steps.push({ type: "condition", check, value, negate: s.negate === true, skip });
        break;
      }
      default:
        return { ok: false, error: `${at} unknown step type.` };
    }
  }
  return { ok: true, steps };
}

export function describeStep(s: Step, names?: Record<string, string>): string {
  switch (s.type) {
    case "send_email": return `Send email “${s.subject}”`;
    case "add_tag": return `Add tag ${s.tag}`;
    case "remove_tag": return `Remove tag ${s.tag}`;
    case "wait": return s.hours % 24 === 0 ? `Wait ${s.hours / 24} day${s.hours === 24 ? "" : "s"}` : `Wait ${s.hours} hour${s.hours === 1 ? "" : "s"}`;
    case "condition": {
      const what = `${s.negate ? "NOT " : ""}${CONDITIONS[s.check]}${s.value ? ` ${names?.[s.value] ?? s.value}` : ""}`;
      return `If ${what.toLowerCase()} continue; otherwise ${s.skip === 0 ? "stop" : `skip ${s.skip} step${s.skip === 1 ? "" : "s"}`}`;
    }
  }
}
