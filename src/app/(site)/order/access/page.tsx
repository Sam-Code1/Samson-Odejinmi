import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { OrderAccessForm } from "@/components/shop/OrderAccessForm";

export const metadata: Metadata = { title: "Get your download link", robots: { index: false, follow: true } };

/** Regenerate private order links: they're emailed ONLY to the purchase email, so nothing here reveals any order. */
export default function OrderAccessPage() {
  return (
    <Container className="pb-24 pt-14 sm:pt-20 lg:pt-24">
      <div className="mx-auto max-w-xl">
        <h1 className="text-h2">Get your download link</h1>
        <p className="mt-3 text-body text-ink-2">Bought something without an account, or your link expired? Enter the email you used at checkout and we&apos;ll send you new private links to every purchase on it. You won&apos;t need to buy again.</p>
        <div className="mt-8"><OrderAccessForm /></div>
        <p className="mt-8 text-caption text-ink-3">Have an account? Your purchases are always in your <Link href="/library" className="underline underline-offset-4">Library</Link>.</p>
      </div>
    </Container>
  );
}
