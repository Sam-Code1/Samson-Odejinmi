import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CourseCard } from "@/components/brand/CourseCard";
import { BookCard, BOOKS } from "@/components/books/BookParts";
import { academyRoot } from "@/app/fonts";
import type { PublicCourse } from "@/lib/academy";
import type { ProductCard } from "@/lib/products";

const W = "mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10";

function Head({ label, title, href, cta }: { label: string; title: string; href: string; cta: string }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div><p className="fa-label">{label}</p><h2 className="mt-3 text-h2">{title}</h2></div>
      <Link href={href} className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-blue hover:underline hover:underline-offset-4">{cta}<ArrowRight aria-hidden className="h-4 w-4" /></Link>
    </div>
  );
}

/** Books and courses from Fola Academy, shown on the main site (real, published items only; hidden when there are none). */
export function AcademyShelf({ books, courses }: { books: ProductCard[]; courses: PublicCourse[] }) {
  if (!books.length && !courses.length) return null;
  return (
    <div className={academyRoot("border-b border-line bg-canvas text-ink")}>
      {books.length > 0 && (
        <section id="books" className="scroll-mt-24 py-14 sm:py-20">
          <div className={W}>
            <Head label="Books" title="Read it, then build it." href={BOOKS} cta="All books" />
            <ul className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
              {books.map((b, i) => <li key={b.id}><BookCard p={b} currency={b.prices[0]?.currency ?? "NGN"} index={i} /></li>)}
            </ul>
          </div>
        </section>
      )}
      {courses.length > 0 && (
        <section id="courses" className={`scroll-mt-24 py-14 sm:py-20 ${books.length ? "border-t border-line" : ""}`}>
          <div className={W}>
            <Head label="Courses" title="Learn it step by step." href="/academy/courses" cta="All courses" />
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {courses.map((c, i) => <li key={c.slug}><CourseCard c={c} index={i} /></li>)}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
