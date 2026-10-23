import type { AdminContext } from "./guard";
import type { TrendPoint } from "@/components/admin/charts/TrendChart";

/**
 * Time series for the admin dashboard and analytics, computed from stored rows (RLS applies: admins only).
 * One query per source covers the current period AND the one before it, so every chart can show "vs previous".
 * Buckets: daily up to a month, weekly for 90 days, monthly for a year. Dates are bucketed in Lagos time.
 */
const DAY = 86_400_000;
const TZ = "Africa/Lagos";
const ROW_LIMIT = 20_000;

type Bucket = { start: number; end: number; label: string; full: string };

export function makeBuckets(days: number, now = Date.now()): { cur: Bucket[]; prev: Bucket[]; from: number; prevFrom: number } {
  const size = days <= 31 ? 1 : days <= 120 ? 7 : 30.4375;
  const count = Math.round(days / size);
  const end = now;
  const step = size * DAY;
  const mk = (offset: number): Bucket[] => Array.from({ length: count }, (_, i) => {
    const s = end - offset - (count - i) * step, e = s + step;
    const d = new Date(e - 1);
    const label = size === 1 ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TZ })
      : size === 7 ? new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: TZ })
      : d.toLocaleDateString("en-GB", { month: "short", timeZone: TZ });
    const full = size === 1 ? d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: TZ })
      : size === 7 ? `Week of ${new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: TZ })}`
      : d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: TZ });
    return { start: s, end: e, label, full };
  });
  const cur = mk(0), prev = mk(count * step);
  return { cur, prev, from: cur[0].start, prevFrom: prev[0].start };
}

function bin(rows: { at: string | null; v: number }[], buckets: Bucket[]) {
  const out = buckets.map(() => 0);
  for (const r of rows) {
    if (!r.at) continue;
    const t = new Date(r.at).getTime();
    if (t < buckets[0].start || t >= buckets[buckets.length - 1].end) continue;
    const i = buckets.findIndex((b) => t >= b.start && t < b.end);
    if (i >= 0) out[i] += r.v;
  }
  return out;
}

export type Series = { points: TrendPoint[]; total: number; prevTotal: number; spark: number[] };

function series(rows: { at: string | null; v: number }[], b: ReturnType<typeof makeBuckets>): Series {
  const cur = bin(rows, b.cur), prev = bin(rows, b.prev);
  return {
    points: b.cur.map((k, i) => ({ label: k.label, full: k.full, value: cur[i], prev: prev[i] })),
    total: cur.reduce((a, c) => a + c, 0), prevTotal: prev.reduce((a, c) => a + c, 0), spark: cur,
  };
}

export type DashboardSeries = {
  revenue: Record<string, Series>; currencies: string[]; orders: Series; enrolments: Series; signups: Series; lessons: Series;
  failed: boolean;
};

/** Revenue (per currency: never summed across currencies), paid orders, enrolments, sign-ups and lesson completions. */
export async function getDashboardSeries(ctx: AdminContext, days: number): Promise<DashboardSeries> {
  const b = makeBuckets(days);
  const since = new Date(b.prevFrom).toISOString();
  const sb = ctx.supabase;
  const [pay, enr, sign, les] = await Promise.all([
    ctx.can("payments")
      ? sb.from("payments").select("created_at, paid_at, amount_minor, currency").eq("status", "successful").gte("created_at", since).limit(ROW_LIMIT)
      : Promise.resolve({ data: [], error: null }),
    sb.from("enrolments").select("granted_at").gte("granted_at", since).limit(ROW_LIMIT),
    sb.from("profiles").select("created_at").gte("created_at", since).limit(ROW_LIMIT),
    sb.from("lesson_progress").select("completed_at").eq("completed", true).gte("completed_at", since).limit(ROW_LIMIT),
  ]);
  const payRows = (pay.data ?? []) as { created_at: string; paid_at: string | null; amount_minor: number; currency: string }[];
  const byCur = new Map<string, { at: string; v: number }[]>();
  for (const p of payRows) byCur.set(p.currency, [...(byCur.get(p.currency) ?? []), { at: p.paid_at ?? p.created_at, v: Number(p.amount_minor) || 0 }]);
  const revenue = Object.fromEntries([...byCur].map(([c, rows]) => [c, series(rows, b)]));
  const currencies = Object.keys(revenue).sort((x, y) => revenue[y].total - revenue[x].total || (x === "NGN" ? -1 : 1));
  return {
    revenue, currencies: currencies.length ? currencies : ["NGN"],
    orders: series(payRows.map((p) => ({ at: p.paid_at ?? p.created_at, v: 1 })), b),
    enrolments: series(((enr.data ?? []) as { granted_at: string }[]).map((r) => ({ at: r.granted_at, v: 1 })), b),
    signups: series(((sign.data ?? []) as { created_at: string }[]).map((r) => ({ at: r.created_at, v: 1 })), b),
    lessons: series(((les.data ?? []) as { completed_at: string | null }[]).map((r) => ({ at: r.completed_at, v: 1 })), b),
    failed: !!(pay.error || enr.error || sign.error || les.error),
  };
}

export const emptySeries = (days: number): Series => series([], makeBuckets(days));
