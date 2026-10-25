import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FaContainer, FaSection } from "@/components/brand/Shell";
import { getPublicOffers, pct } from "@/lib/affiliate";
import { TYPE_LABELS, type ProductType } from "@/lib/product-types";

export const revalidate = 300;

export const metadata: Metadata = {
  title: { absolute: "Affiliate programme — Fola Academy" },
  description: "Share Fola Academy's courses and books with your audience and earn a commission on every sale. No course purchase needed: anyone can apply.",
  alternates: { canonical: "/affiliates" },
};

const STEPS = [
  { n: "01", title: "Apply", body: "Create an account (you don't need to buy anything) and tell us how you'll share Fola Academy. We review every application by hand." },
  { n: "02", title: "Share a link", body: "Get a personal link for each course and book, or for the whole Academy. Copy it, or share it straight from your phone." },
  { n: "03", title: "Earn", body: "When someone buys within 30 days of clicking, you earn a commission on what they actually paid. Track it all on your own dashboard." },
];

const RULES = [
  "Open to everyone: students, creators, teachers, communities and people with a following of any size.",
  "Commission is a percentage of the amount actually paid, after any discount. Each product shows its own rate.",
  "A sale counts if it happens within 30 days of the click. Your own purchases don't earn commission.",
  "Commissions are approved after the refund window, then paid by bank transfer. A refunded sale cancels its commission.",
  "No spam, no misleading claims, and no pretending to be Fola Academy. We can remove affiliates who break these rules.",
];

export default async function AffiliatesPage() {
  const offers = await getPublicOffers();
  return (
    <>
      <section className="fa-blueprint border-b border-line">
        <FaContainer className="py-14 sm:py-20 lg:py-24">
          <p className="fa-label fa-rise">Affiliate programme</p>
          <h1 className="mt-5 max-w-3xl text-h1 !text-[clamp(2.25rem,1.6rem+2.6vw,4rem)] !font-extrabold !leading-[1] fa-rise" style={{ animationDelay: "60ms" }}>Share it. Earn from it.</h1>
          <p className="mt-6 max-w-[38rem] text-body-lg text-ink-2 fa-rise" style={{ animationDelay: "120ms" }}>Recommend Fola Academy&apos;s courses and books to people who&apos;d like them, and earn a commission on every sale. You don&apos;t have to be a student.</p>
          <div className="mt-9 flex flex-wrap gap-3 fa-rise" style={{ animationDelay: "180ms" }}>
            <Link href="/affiliate" className="fa-btn fa-btn-primary fa-btn-lg">Join the programme<ArrowRight aria-hidden className="fa-arrow h-4 w-4" /></Link>
            <Link href="/login?next=/affiliate" className="fa-btn fa-btn-secondary fa-btn-lg">I have an account</Link>
          </div>
          <p className="mt-4 text-caption text-ink-3">New here? You&apos;ll be asked to <Link href="/register?next=/affiliate" className="underline underline-offset-4 hover:text-ink">create a free account</Link> first.</p>
        </FaContainer>
      </section>

      <FaSection label="How it works" title="Three steps.">
        <ol className="grid gap-8 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="border-t border-line pt-5">
              <p className="fa-label">{s.n}</p>
              <h3 className="mt-3 text-h4">{s.title}</h3>
              <p className="mt-2 text-body-sm text-ink-2">{s.body}</p>
            </li>
          ))}
        </ol>
      </FaSection>

      {offers.length > 0 && (
        <FaSection label="What you can promote" title="What each product pays." intro="Rates are set per product. Share the one that fits your audience, with a link made just for it.">
          <ul className="divide-y divide-line border-y border-line">
            {offers.map((o) => (
              <li key={`${o.type}-${o.slug}`} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-4">
                <div className="min-w-0">
                  <p className="font-medium [overflow-wrap:anywhere]">{o.name}</p>
                  <p className="text-caption text-ink-3">{TYPE_LABELS[o.type as ProductType] ?? "Product"}</p>
                </div>
                <p className="text-h4 tabular-nums">{pct(o.rate_bps)}<span className="ml-2 text-caption font-normal text-ink-3">per sale</span></p>
              </li>
            ))}
          </ul>
        </FaSection>
      )}

      <FaSection label="The rules" title="Straightforward, and fair.">
        <ul className="max-w-3xl space-y-3 text-body text-ink-2">
          {RULES.map((r) => <li key={r} className="flex gap-3"><span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-node" /><span>{r}</span></li>)}
        </ul>
        <div className="mt-10">
          <Link href="/affiliate" className="fa-btn fa-btn-primary fa-btn-lg">Apply now<ArrowRight aria-hidden className="fa-arrow h-4 w-4" /></Link>
        </div>
      </FaSection>
    </>
  );
}
