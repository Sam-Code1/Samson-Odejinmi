import type { Metadata } from "next";
import { BookView, bookMetadata } from "@/components/books/BookView";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return bookMetadata((await params).slug);
}

export default async function BookPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ reviews?: string }> }) {
  const [{ slug }, { reviews }] = await Promise.all([params, searchParams]);
  return <BookView slug={slug} reviewPage={Math.max(1, Number.parseInt(reviews ?? "1", 10) || 1)} />;
}
