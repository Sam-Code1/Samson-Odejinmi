import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Container, Section, SectionHeader } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { CarouselStacked, type Slide } from "@/components/ui/carousel-07";
import { HeroPreviewWalls } from "@/components/ui/hero-preview-walls";
import { AcademyVisual } from "@/components/visual/AcademyVisual";
import { WorkflowStack } from "@/components/sections/StepStack";
import { Paragraphs, plainTitle } from "@/components/cms/RichText";
import { IntroReveal } from "@/components/showcase/IntroReveal";
import { Playground } from "@/components/showcase/Playground";
import { WhatsAppButton } from "@/components/showcase/WhatsAppButton";
import { backdropWord, gameLines, introWords, whatsappHref } from "@/lib/showcase";
import { getPage, getProjects, getSiteSettings } from "@/lib/cms";
import { buildMetadata } from "@/lib/cms/seo";
import { DEFAULT_HERO_SCENE, canOptimize, safeImageSrc, splineSceneUrl } from "@/lib/cms/images";
import { getPublishedCourse } from "@/lib/academy";
import type { Section as CmsSection } from "@/lib/cms/types";
import { site } from "@/lib/site";

export const revalidate = 3600;

/** Still frame of the hero robot (public/images/hero-robot.png): instant paint, and the reduced-motion fallback. */
const HERO_POSTER = existsSync(join(process.cwd(), "public/images/hero-robot.png")) ? "/images/hero-robot.png" : null;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("home", { path: "/", absoluteTitle: true });
}

export default async function HomePage() {
  const [page, projects, services, settings] = await Promise.all([getPage("home"), getProjects(), getPage("services"), getSiteSettings()]);
  const featured = projects.filter((p) => p.featured);
  const steps = services.process?.items ?? [];
  const whatsapp = whatsappHref(settings.whatsappNumber, settings.whatsappMessage);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: settings.fullName,
    alternateName: [settings.siteName, site.alias],
    url: site.url,
    ...(settings.jobTitle ? { jobTitle: settings.jobTitle } : {}),
  };

  const render = async (s: CmsSection) => {
    switch (s.key) {
      case "hero": {
        // The hero is built on the interactive 3D (Spline) card. An empty scene URL falls back to the static 3D artwork.
        // An explicitly empty URL means "use the static artwork". Older databases keep the URL on the retired interactive_3d row.
        const own = s.settings.scene_url;
        const scene = typeof own === "string" ? splineSceneUrl(own) : splineSceneUrl(page.interactive_3d?.settings.scene_url) ?? DEFAULT_HERO_SCENE;
        const src = safeImageSrc(s.imageUrl);
        const portrait = src ? { src, alt: s.imageAlt ?? `Portrait of ${settings.fullName}`, optimize: canOptimize(src), word: backdropWord(s.settings.backdrop_word) } : null;
        return <HeroPreviewWalls key={s.key} hero={s} scene={scene} portrait={portrait} poster={HERO_POSTER} />;
      }

      case "statement":
        return s.title ? (
          <Section key={s.key} tone="violet" className="!py-20 sm:!py-28">
            <Container><p className="max-w-5xl text-h1">{s.title}</p></Container>
          </Section>
        ) : null;

      case "interactive_3d":
        return null; // Merged into the hero.

      case "selected_work": {
        if (!featured.length) return null;
        const slides: Slide[] = featured.map((p) => ({
          id: p.id, title: p.title, description: p.shortDescription, badge: p.placeholder ? "Placeholder" : p.category ?? p.projectStatus,
          href: `/portfolio/${p.slug}`, image: p.coverImage,
        }));
        return (
          <Section key={s.key} id="work">
            <Container>
              <div className="flex flex-wrap items-end justify-between gap-6">
                <SectionHeader title={s.title ?? "Selected work"} intro={s.body ?? undefined} />
                {s.cta?.label && <Button href={s.cta.href} variant="text">{s.cta.label}</Button>}
              </div>
              <div className="mt-10"><CarouselStacked slides={slides} label={plainTitle(s.title ?? "Selected work")} /></div>
            </Container>
          </Section>
        );
      }

      case "about_preview": {
        const img = safeImageSrc(s.imageUrl);
        return (
          <Section key={s.key} tone="peach">
            <Container>
              <div className="grid items-center gap-14 lg:grid-cols-12">
                {img && (
                  <div className="lg:col-span-5">
                    <div className="relative max-w-md">
                      <span aria-hidden className="absolute -bottom-4 -right-4 h-full w-full rounded-sm bg-tint-violet" />
                      <div className="relative aspect-[4/5] overflow-hidden rounded-sm">
                        <Image src={img} alt={s.imageAlt ?? ""} fill sizes="(min-width: 1024px) 28rem, 90vw" unoptimized={!canOptimize(img)} className="object-cover" />
                        <span aria-hidden className="thread-v absolute inset-y-0 left-0 w-px" />
                      </div>
                    </div>
                  </div>
                )}
                <div className={img ? "lg:col-span-6 lg:col-start-7" : "lg:col-span-8"}>
                  {s.title && <h2 className="text-h2">{s.title}</h2>}
                  <Paragraphs text={s.body} className="mt-8 space-y-5 text-body-lg text-ink-2" />
                  {s.cta?.label && <div className="mt-10"><Button href={s.cta.href} variant="text">{s.cta.label}</Button></div>}
                </div>
              </div>
            </Container>
          </Section>
        );
      }

      case "disciplines":
        return s.items.length ? (
          <Section key={s.key}>
            <Container>
              {s.title && <SectionHeader title={s.title} intro={s.body ?? undefined} />}
              <ul className="mt-12 border-t border-line">
                {s.items.map((d, i) => (
                  <li key={`${d.title}-${i}`} className="group border-b border-line">
                    <Link href={s.cta?.href ?? "/services"} className="flex items-center justify-between gap-6 py-5 sm:py-6">
                      <span className="text-h3 transition-transform duration-base ease-quiet group-hover:translate-x-2">{d.title}</span>
                      <span aria-hidden className="thread-solid hidden h-px w-0 transition-all duration-base ease-quiet group-hover:w-24 sm:block" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Container>
          </Section>
        ) : null;

      case "academy": {
        const slug = typeof s.settings.featured_course_slug === "string" ? s.settings.featured_course_slug : "";
        const course = slug ? await getPublishedCourse(slug) : null;
        return (
          <Section key={s.key} tone="night" id="academy">
            <Container>
              <div className="grid items-center gap-14 lg:grid-cols-12">
                <div className="lg:col-span-6">
                  {s.eyebrow && <p className="text-label text-ink-3">{s.eyebrow}</p>}
                  {s.title && <h2 className="mt-4 text-h1">{s.title}</h2>}
                  <Paragraphs text={s.body} className="mt-7 max-w-prose space-y-4 text-body-lg text-ink-2" />
                  {s.items.length > 0 && (
                    <ol className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-3 text-label">
                      {s.items.map((st, i) => (
                        <li key={`${st.title}-${i}`} className="flex items-center gap-4">
                          <span>{st.title}</span>
                          {i < s.items.length - 1 && <span aria-hidden className="thread-solid h-px w-8" />}
                        </li>
                      ))}
                    </ol>
                  )}
                  {course && (
                    <p className="mt-8 text-body-sm text-ink-2">
                      Featured course: <Link href={`/academy/courses/${course.slug}`} className="text-ink"><span className="link-line pb-0.5">{course.title}</span></Link>
                    </p>
                  )}
                  {(s.cta || s.cta2) && (
                    <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
                      {s.cta?.label && <Button href={s.cta.href}>{s.cta.label}</Button>}
                      {s.cta2 && <Button href={s.cta2.href} variant="text">{s.cta2.label}</Button>}
                    </div>
                  )}
                </div>
                <div className="lg:col-span-6">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-surface">
                    <AcademyVisual className="absolute inset-0 h-full w-full" />
                  </div>
                </div>
              </div>
            </Container>
          </Section>
        );
      }

      case "workflow":
        return (
          <Section key={s.key} tone="blue">
            <Container>
              <div className="grid items-center gap-14 lg:grid-cols-12">
                <div className="lg:col-span-5">
                  {s.title && <SectionHeader title={s.title} intro={s.body ?? undefined} />}
                  {s.cta?.label && <div className="mt-8"><Button href={s.cta.href} variant="text">{s.cta.label}</Button></div>}
                </div>
                <div className="flex justify-center pb-6 lg:col-span-7"><WorkflowStack steps={steps} /></div>
              </div>
            </Container>
          </Section>
        );

      case "exploring":
        return s.items.length ? (
          <Section key={s.key} tone="mint">
            <Container>
              {s.title && <SectionHeader title={s.title} intro={s.body ?? undefined} />}
              <dl className="mt-12 grid gap-x-12 sm:grid-cols-2">
                {s.items.map((e, i) => (
                  <div key={`${e.title}-${i}`} className="border-t border-line py-6">
                    <dt className="text-h4">{e.title}</dt>
                    {e.body && <dd className="mt-1 text-body-sm text-ink-2">{e.body}</dd>}
                  </div>
                ))}
              </dl>
            </Container>
          </Section>
        ) : null;

      case "playground": {
        const lines = gameLines(s.settings.game_text);
        return lines ? <Playground key={s.key} section={s} lines={lines} /> : null;
      }

      case "contact_cta":
        return s.title ? (
          <Section key={s.key} tone="night">
            <Container>
              <div className="flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-end">
                <h2 className="max-w-3xl text-h1">{s.title}</h2>
                <div className="flex flex-wrap items-center gap-4">
                  {s.cta?.label && <Button href={s.cta.href} size="lg">{s.cta.label}</Button>}
                  {whatsapp && <WhatsAppButton href={whatsapp} size="lg" />}
                </div>
              </div>
            </Container>
          </Section>
        ) : null;

      default:
        return null;
    }
  };

  const blocks = await Promise.all(Object.values(page).map(render));
  const intro = introWords(page.hero?.settings.intro_words);

  return (
    <>
      {intro.length > 0 && <IntroReveal words={intro} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      {blocks}
    </>
  );
}
