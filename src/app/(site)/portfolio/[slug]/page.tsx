import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, Section } from "@/components/ui/Container";
import { MediaFrame } from "@/components/visual/MediaFrame";
import { ProjectMeta } from "@/components/sections/ProjectCard";
import { Button } from "@/components/ui/Button";
import { Paragraphs } from "@/components/cms/RichText";
import { getProject, getProjects, getSiteSettings } from "@/lib/cms";

export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getProjects()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [p, settings] = await Promise.all([getProject(slug), getSiteSettings()]);
  if (!p) return {};
  const title = p.seoTitle ?? p.title;
  const description = p.seoDescription ?? p.shortDescription;
  const image = p.coverImage?.src ?? settings.defaultOgImage ?? undefined;
  return {
    title: p.seoTitle ? { absolute: p.seoTitle } : title,
    description,
    alternates: { canonical: `/portfolio/${p.slug}` },
    openGraph: { title, description, url: `/portfolio/${p.slug}`, ...(image ? { images: [{ url: image }] } : {}) },
    robots: p.placeholder || p.status !== "published" ? { index: false } : undefined,
  };
}

function Block({ title, text }: { title: string; text: string | null }) {
  if (!text) return null;
  return (
    <section className="mt-14 first:mt-0">
      <h2 className="text-h3">{title}</h2>
      <Paragraphs text={text} className="mt-4 space-y-4 text-body-lg text-ink-2" />
    </section>
  );
}

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [project, projects] = await Promise.all([getProject(slug), getProjects()]);
  if (!project) notFound();

  const idx = projects.findIndex((p) => p.id === project.id);
  const next = projects.length > 1 ? projects[(idx + 1) % projects.length] : null;
  const facts: [string, string | null | undefined][] = [
    ["Category", project.categories.join(", ")],
    ["Type", project.projectType],
    ["Status", project.projectStatus],
    ["Year", project.year?.toString()],
    ["Role", project.role],
    ["Client", project.client],
    ["Services", project.services.join(", ")],
    ["Tools", project.tools.join(", ")],
  ];
  const links = [project.projectUrl && { href: project.projectUrl, label: "View project" }, project.externalUrl && { href: project.externalUrl, label: "View externally" }].filter(Boolean) as { href: string; label: string }[];

  return (
    <>
      <section>
        <Container className="pb-10 pt-14 sm:pt-20 lg:pt-24">
          <Link href="/portfolio" className="text-label text-ink-3 hover:text-ink"><span className="link-line pb-0.5">All work</span></Link>
          <h1 className="mt-8 max-w-4xl text-h1">{project.title}</h1>
          {project.shortDescription && <p className="mt-6 max-w-prose text-body-lg text-ink-2">{project.shortDescription}</p>}
          <div className="mt-6"><ProjectMeta project={project} /></div>
        </Container>
      </section>

      <Container>
        <MediaFrame image={project.coverImage} ratio="16/9" variant={Math.max(idx, 0)} label={project.placeholder ? "Placeholder · image to come" : undefined} priority sizes="100vw" />
      </Container>

      <Section className="!pt-16 sm:!pt-24">
        <Container className="grid gap-14 lg:grid-cols-12">
          <dl className="lg:col-span-4">
            {facts.filter(([, v]) => v).map(([k, v]) => (
              <div key={k} className="border-t border-line py-4 first:border-t-0 first:pt-0">
                <dt className="text-caption text-ink-3">{k}</dt>
                <dd className="mt-1 text-body-sm">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="lg:col-span-7 lg:col-start-6">
            {project.placeholder && (
              <p className="mb-8 border-l-2 border-blue pl-4 text-body-sm text-ink-2">This is a placeholder entry, not a finished project. Real work will replace it.</p>
            )}
            <Block title="Overview" text={project.description} />
            <Block title="The challenge" text={project.challenge} />
            <Block title="Approach" text={project.approach} />
            {project.process.length > 0 && (
              <section className="mt-14">
                <h2 className="text-h3">Process</h2>
                <ol className="mt-6 space-y-8">
                  {project.process.map((s, i) => (
                    <li key={`${s.title}-${i}`} className="grid grid-cols-[2.5rem_1fr] gap-4">
                      <span className="pt-1 text-caption tabular-nums text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                      <div>{s.title && <h3 className="text-h4">{s.title}</h3>}{s.body && <p className="mt-1 text-body-sm text-ink-2">{s.body}</p>}</div>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            <Block title="Outcome" text={project.outcome} />
            {links.length > 0 && <div className="mt-10 flex flex-wrap gap-x-8 gap-y-4">{links.map((l) => <Button key={l.href} href={l.href} variant="text">{l.label}</Button>)}</div>}
          </div>
        </Container>
      </Section>

      {project.video && (
        <Container className="pb-16">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-line bg-surface">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${project.video.id}?rel=0&modestbranding=1&playsinline=1`}
              title={`${project.title} video`} loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin" className="absolute inset-0 h-full w-full border-0"
            />
          </div>
        </Container>
      )}

      {project.gallery.length > 0 && (
        <Container className="pb-20">
          <h2 className="sr-only">Gallery</h2>
          <ul className="grid gap-6 md:grid-cols-2">
            {project.gallery.map((g, i) => (
              <li key={g.id} className={i % 3 === 0 ? "md:col-span-2" : ""}>
                <figure>
                  <MediaFrame image={{ src: g.src, alt: g.alt }} ratio={i % 3 === 0 ? "16/9" : "4/3"} sizes={i % 3 === 0 ? "100vw" : "(min-width: 768px) 50vw, 100vw"} />
                  {g.caption && <figcaption className="mt-3 text-caption text-ink-3">{g.caption}</figcaption>}
                </figure>
              </li>
            ))}
          </ul>
        </Container>
      )}

      {next && next.id !== project.id && (
        <section className="border-t border-line">
          <Container className="py-14">
            <p className="text-caption text-ink-3">Next</p>
            <Link href={`/portfolio/${next.slug}`} className="group mt-3 inline-block text-h2"><span className="link-line pb-1">{next.title}</span></Link>
          </Container>
        </section>
      )}
    </>
  );
}
