import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { legalPages } from "@/lib/site";

type Slug = keyof typeof legalPages;

export function generateStaticParams() {
  return Object.keys(legalPages).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const title = legalPages[slug as Slug];
  return title ? { title, robots: { index: false } } : {};
}

/**
 * Placeholder legal pages. Replace the body with real policies, reviewed by a
 * qualified person, before enrolment or payments go live.
 */
export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const title = legalPages[slug as Slug];
  if (!title) notFound();
  return (
    <Container className="py-20 sm:py-28">
      <h1 className="text-h1">{title}</h1>
      <p className="mt-8 max-w-prose text-body-lg text-ink-2">
        This page is being written and will be published before course enrolment opens. If you have a question in the meantime, please get in touch.
      </p>
    </Container>
  );
}
