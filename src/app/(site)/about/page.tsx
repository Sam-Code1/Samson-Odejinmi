import type { Metadata } from "next";
import Image from "next/image";
import { Container, Section, SectionHeader, type Tone } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Paragraphs } from "@/components/cms/RichText";
import { getPage, getSocialLinks } from "@/lib/cms";
import { buildMetadata } from "@/lib/cms/seo";
import { canOptimize, safeImageSrc } from "@/lib/cms/images";
import type { Section as CmsSection } from "@/lib/cms/types";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("about", {
    title: "About",
    description: "Samson Afolabi Odejinmi, known as Fola: a 3D artist and designer studying Computer Science and exploring creative technology.",
    path: "/about",
  });
}

/** Heading on the left, paragraphs on the right: the About page's editorial layout. */
function Split({ s, tone }: { s: CmsSection; tone?: Tone }) {
  if (!s.title && !s.body) return null;
  return (
    <Section tone={tone} id={s.key}>
      <Container className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          {s.title && <h2 className="text-h2">{s.title}</h2>}
          {s.eyebrow && <p className="mt-5 text-body text-ink-3">{s.eyebrow}</p>}
        </div>
        <div className="lg:col-span-7 lg:col-start-6">
          <Paragraphs text={s.body} className="space-y-6 text-body-lg text-ink-2" />
          {s.cta?.label && <div className="pt-8"><Button href={s.cta.href} variant="text">{s.cta.label}</Button></div>}
        </div>
      </Container>
    </Section>
  );
}

export default async function AboutPage() {
  const [page, home, socials] = await Promise.all([getPage("about"), getPage("home"), getSocialLinks()]);
  // Skills and current focus are shared with the homepage so they're edited in one place.
  const disciplines = home.disciplines?.items ?? [];
  const exploring = home.exploring?.items ?? [];

  const blocks = Object.values(page).map((s) => {
    switch (s.key) {
      case "intro": {
        const img = safeImageSrc(s.imageUrl);
        return (
          <section key={s.key} className="mesh grain relative overflow-hidden border-b border-line">
            <Container className="grid gap-12 pb-16 pt-14 sm:pt-20 lg:grid-cols-12 lg:pb-24 lg:pt-28">
              <div className="lg:col-span-7">
                {s.title && <h1 className="text-h1">{s.title}</h1>}
                <Paragraphs text={s.body} className="mt-8 max-w-prose space-y-4 text-body-lg text-ink-2" />
                {socials.length > 0 && (
                  <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-label">
                    {socials.map((l) => <li key={l.id}><a href={l.url} target="_blank" rel="noopener noreferrer" className="text-ink-2 hover:text-ink"><span className="link-line pb-0.5">{l.label}</span></a></li>)}
                  </ul>
                )}
              </div>
              {img && (
                <div className="lg:col-span-4 lg:col-start-9">
                  <div className="relative aspect-[4/5] max-w-sm overflow-hidden rounded-sm">
                    <Image src={img} alt={s.imageAlt ?? ""} fill priority sizes="(min-width: 1024px) 24rem, 80vw" unoptimized={!canOptimize(img)} className="object-cover" />
                    <span aria-hidden className="thread-v absolute inset-y-0 left-0 w-px" />
                  </div>
                </div>
              )}
            </Container>
          </section>
        );
      }
      case "story":
      case "direction":
        return <Split key={s.key} s={s} />;
      case "philosophy":
        return <Split key={s.key} s={s} tone="peach" />;
      case "narrio":
        return <Split key={s.key} s={s} tone="violet" />;
      case "disciplines":
        return disciplines.length ? (
          <Section key={s.key}>
            <Container>
              {s.title && <SectionHeader title={s.title} intro={s.body ?? undefined} />}
              <ul className="mt-10 flex flex-wrap gap-x-3 gap-y-3">
                {disciplines.map((d, i) => <li key={`${d.title}-${i}`} className="rounded-sm border border-line-strong px-4 py-2 text-label text-ink-2">{d.title}</li>)}
              </ul>
            </Container>
          </Section>
        ) : null;
      case "exploring":
        return exploring.length ? (
          <Section key={s.key} tone="mint">
            <Container className="grid gap-12 lg:grid-cols-12">
              <div className="lg:col-span-4">
                {s.title && <h2 className="text-h2">{s.title}</h2>}
                {s.body && <p className="mt-5 text-body text-ink-2">{s.body}</p>}
              </div>
              <dl className="lg:col-span-7 lg:col-start-6">
                {exploring.map((e, i) => (
                  <div key={`${e.title}-${i}`} className="border-t border-line py-5 first:border-t-0 first:pt-0">
                    <dt className="text-h4">{e.title}</dt>
                    {e.body && <dd className="mt-1 text-body-sm text-ink-2">{e.body}</dd>}
                  </div>
                ))}
              </dl>
            </Container>
          </Section>
        ) : null;
      case "timeline":
        return s.items.length ? (
          <Section key={s.key}>
            <Container>
              {s.title && <SectionHeader title={s.title} intro={s.body ?? undefined} />}
              <ol className="relative mt-14 max-w-3xl border-l border-line pl-8">
                <span aria-hidden className="thread-v absolute -left-px top-0 h-24 w-px" />
                {s.items.map((t, i) => (
                  <li key={`${t.title}-${i}`} className="relative pb-12 last:pb-0">
                    <span aria-hidden className="absolute -left-[2.3125rem] top-2 h-2 w-2 rounded-full bg-ink" />
                    {t.meta && <p className="text-caption text-ink-3">{t.meta}</p>}
                    {t.title && <h3 className="mt-1 text-h4">{t.title}</h3>}
                    {t.body && <p className="mt-2 max-w-prose text-body-sm text-ink-2">{t.body}</p>}
                  </li>
                ))}
              </ol>
            </Container>
          </Section>
        ) : null;
      case "contact_cta":
        return s.title ? (
          <Section key={s.key} tone="night">
            <Container className="flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-end">
              <h2 className="max-w-3xl text-h1">{s.title}</h2>
              {s.cta?.label && <Button href={s.cta.href} size="lg">{s.cta.label}</Button>}
            </Container>
          </Section>
        ) : null;
      default:
        return <Split key={s.key} s={s} />;
    }
  });

  return <>{blocks}</>;
}
