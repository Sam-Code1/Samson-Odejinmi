import Link from "next/link";

export function StatCard({ label, value, hint, href }: { label: string; value: string | number; hint?: string; href?: string }) {
  const body = (
    <>
      <p className="text-caption font-medium text-ink-3">{label}</p>
      <p className="mt-2 text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums">{value}</p>
      {hint && <p className="mt-2 text-caption text-ink-3">{hint}</p>}
    </>
  );
  const cls = "block rounded-lg border border-line bg-elevated p-5 transition-colors";
  return href ? <Link href={href} className={`${cls} hover:border-line-strong`}>{body}</Link> : <div className={cls}>{body}</div>;
}
