import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { LEGAL_DOCS, legalDoc, type LegalBlock } from "@/content/legal";
import { getSiteSettings } from "@/lib/cms";

export const revalidate = 3600;

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = legalDoc(slug);
  return doc ? { title: doc.title, description: doc.summary, alternates: { canonical: `/legal/${doc.slug}` } } : {};
}

const W = "mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-10";

/** "{email}" in the text becomes a mailto link to the contact address from the site settings. */
function Text({ text, email }: { text: string; email: string }) {
  const parts = text.split("{email}");
  return <>{parts.map((p, i) => <span key={i}>{p}{i < parts.length - 1 && <a href={`mailto:${email}`} className="font-medium text-ink underline underline-offset-4 hover:text-blue">{email}</a>}</span>)}</>;
}

function Block({ b, email }: { b: LegalBlock; email: string }) {
  if (typeof b === "string") return <p><Text text={b} email={email} /></p>;
  if ("list" in b) return <ul className="list-disc space-y-2 pl-5 marker:text-ink-3">{b.list.map((li) => <li key={li}><Text text={li} email={email} /></li>)}</ul>;
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[32rem] border-collapse text-left text-body-sm">
        <thead><tr>{b.table.head.map((h) => <th key={h} scope="col" className="border-b border-line-strong py-2.5 pr-4 font-mono text-[0.7rem] font-medium uppercase tracking-[0.12em] text-ink-3">{h}</th>)}</tr></thead>
        <tbody>{b.table.rows.map((r) => <tr key={r[0]} className="align-top">{r.map((c, i) => <td key={i} className={`border-b border-line py-3 pr-4 ${i === 0 ? "font-medium text-ink" : ""}`}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

/** A legal document: header, sticky contents (desktop), numbered sections, contact box, links to the other documents. */
export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = legalDoc(slug);
  if (!doc) notFound();
  const { contactEmail: email } = await getSiteSettings();
  const others = LEGAL_DOCS.filter((d) => d.slug !== doc.slug);

  return (
    <>
      <section className="border-b border-line">
        <div className={`${W} pb-10 pt-12 sm:pt-16 lg:pt-20`}>
          <p className="fa-label st-rise"><Link href="/legal" className="hover:text-ink">Legal</Link></p>
          <h1 className="mt-4 text-h1 st-rise">{doc.title}</h1>
          <p className="mt-5 max-w-2xl text-body-lg text-ink-2">{doc.summary}</p>
          <p className="fa-label mt-6">Last updated · {doc.updated}</p>
        </div>
      </section>

      <div className={`${W} grid gap-10 py-12 sm:py-16 lg:grid-cols-12`}>
        <nav aria-label="On this page" className="lg:col-span-3">
          <div className="lg:sticky lg:top-24">
            <p className="fa-label">On this page</p>
            <ol className="mt-4 space-y-2 border-l border-line text-body-sm">
              {doc.sections.map((s, i) => (
                <li key={s.id}><a href={`#${s.id}`} className="-ml-px flex gap-3 border-l border-transparent py-0.5 pl-4 text-ink-2 hover:border-ink hover:text-ink"><span className="font-mono text-xs text-ink-3">{String(i + 1).padStart(2, "0")}</span>{s.heading}</a></li>
              ))}
            </ol>
          </div>
        </nav>

        <article className="min-w-0 lg:col-span-8 lg:col-start-5">
          {doc.sections.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-24 border-t border-line py-8 first:border-t-0 first:pt-0">
              <h2 id={`${s.id}-h`} className="flex items-baseline gap-3 text-h3"><span className="font-mono text-sm font-normal text-ink-3">{String(i + 1).padStart(2, "0")}</span>{s.heading}</h2>
              <div className="mt-4 max-w-prose space-y-4 text-body text-ink-2">{s.blocks.map((b, j) => <Block key={j} b={b} email={email} />)}</div>
            </section>
          ))}

          <aside className="mt-8 max-w-prose rounded-[4px] border border-line p-6">
            <p className="fa-label">Questions?</p>
            <p className="mt-3 text-body text-ink-2">Email <a href={`mailto:${email}`} className="font-medium text-ink underline underline-offset-4 hover:text-blue">{email}</a> or use the <Link href="/contact" className="font-medium text-ink underline underline-offset-4 hover:text-blue">contact page</Link>. We reply by email.</p>
          </aside>
        </article>
      </div>

      <section aria-label="Other legal documents" className="border-t border-line">
        <ul className={`${W} grid gap-px py-10 sm:grid-cols-2 lg:grid-cols-4`}>
          {others.map((d) => (
            <li key={d.slug}>
              <Link href={`/legal/${d.slug}`} className="group flex h-full flex-col gap-1 p-4 hover:bg-surface">
                <span className="flex items-center gap-1.5 font-semibold text-ink">{d.title}<ArrowUpRight aria-hidden className="h-4 w-4 text-ink-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span>
                <span className="text-body-sm text-ink-3">{d.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
