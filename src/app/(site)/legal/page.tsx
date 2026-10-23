import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { LEGAL_DOCS } from "@/content/legal";

export const metadata: Metadata = {
  title: "Legal",
  description: "Privacy, terms, Fola Academy terms, refunds and cookies: how this site and Fola Academy work.",
  alternates: { canonical: "/legal" },
};

const W = "mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10";

/** Index of the legal documents. */
export default function LegalIndex() {
  return (
    <>
      <section className="border-b border-line">
        <div className={`${W} pb-10 pt-12 sm:pt-16 lg:pt-20`}>
          <p className="fa-label st-rise">Legal</p>
          <h1 className="mt-4 text-h1 st-rise">The <span className="st-em">small print,</span> in plain English.</h1>
          <p className="mt-5 max-w-2xl text-body-lg text-ink-2">How this website and Fola Academy handle your information, purchases, refunds and certificates.</p>
        </div>
      </section>
      <section className={`${W} py-12 sm:py-16`}>
        <ul className="divide-y divide-line border-y border-line">
          {LEGAL_DOCS.map((d, i) => (
            <li key={d.slug}>
              <Link href={`/legal/${d.slug}`} className="group grid gap-2 py-6 sm:grid-cols-[3rem_1fr_auto] sm:items-baseline sm:gap-6">
                <span className="font-mono text-xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                <span>
                  <span className="block text-h4 text-ink group-hover:text-blue">{d.title}</span>
                  <span className="mt-1 block max-w-2xl text-body-sm text-ink-2">{d.summary}</span>
                </span>
                <span className="fa-label hidden items-center gap-1 sm:inline-flex">Updated {d.updated}<ArrowUpRight aria-hidden className="h-4 w-4" /></span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
