import { BooksView, booksMetadata } from "@/components/books/BooksView";

// Books: the Fola Academy store (canonical). /shop and /academy/shop redirect here (next.config.mjs).
export const generateMetadata = booksMetadata;

export default async function BooksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <BooksView searchParams={await searchParams} />;
}
