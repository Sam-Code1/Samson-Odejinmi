import Link from "next/link";
import type { PriceRow } from "@/content/course";
import type { PublicCourse } from "@/lib/academy";
import { formatMoney } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";

export function CourseSummaryCard({ course, prices }: { course: PublicCourse; prices: PriceRow[] }) {
  return (
    <Link href={`/academy/courses/${course.slug}`} className="group block overflow-hidden rounded-xl border border-line bg-elevated/70 transition-all duration-base hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[0_30px_60px_-36px_rgb(var(--ink)/0.5)]">
      <div className="thread h-px" aria-hidden />
      <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          {course.level && <Badge>{course.level}</Badge>}
          <h3 className="mt-5 text-h2"><span className="link-line pb-1">{course.title}</span></h3>
          {course.subtitle && <p className="mt-4 max-w-prose text-body text-ink-2">{course.subtitle}</p>}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 text-body-sm lg:col-span-5">
          {course.moduleCount > 0 && <div><dt className="text-caption text-ink-3">Modules</dt><dd>{course.moduleCount}</dd></div>}
          {course.lessonCount > 0 && <div><dt className="text-caption text-ink-3">Lessons</dt><dd>{course.lessonCount}</dd></div>}
          <div><dt className="text-caption text-ink-3">Format</dt><dd>Self-paced</dd></div>
          <div><dt className="text-caption text-ink-3">Access</dt><dd>Lifetime</dd></div>
          {course.estimatedDuration && <div><dt className="text-caption text-ink-3">Duration</dt><dd>{course.estimatedDuration}</dd></div>}
          {prices.length > 0 && (
            <div className="col-span-2">
              <dt className="text-caption text-ink-3">Price</dt>
              <dd className="text-h4 tabular-nums">{prices.map((p, i) => <span key={p.currency}>{i > 0 && <span className="text-ink-3"> or </span>}{formatMoney(p.amountMinor, p.currency)}</span>)}</dd>
            </div>
          )}
        </dl>
      </div>
    </Link>
  );
}
