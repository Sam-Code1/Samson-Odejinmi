import type { Metadata } from "next";
import Link from "next/link";
import { Container, Section } from "@/components/ui/Container";
import { EmptyState } from "@/components/ui/States";
import { ProjectCard } from "@/components/sections/ProjectCard";
import { CarouselStacked, type Slide } from "@/components/ui/carousel-07";
import { getPage, getProjects } from "@/lib/cms";
import { buildMetadata } from "@/lib/cms/seo";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("portfolio", {
    title: "Work",
    description: "Selected 3D animation, environment design, product visualisation and creative work by Samson Odejinmi.",
    path: "/portfolio",
  });
}

export default async function PortfolioPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const [{ category }, projects, page] = await Promise.all([searchParams, getProjects(), getPage("portfolio")]);
  const intro = page.intro;
  const usedCategories = [...new Set(projects.flatMap((p) => p.categories))];
  const active = usedCategories.find((c) => c === category);
  const list = active ? projects.filter((p) => p.categories.includes(active)) : projects;
  const slides: Slide[] = list.map((p) => ({ id: p.id, title: p.title, description: p.shortDescription, badge: p.placeholder ? "Placeholder" : p.category ?? p.projectStatus, href: `/portfolio/${p.slug}`, image: p.coverImage }));

  return (
    <>
      <section className="mesh grain relative overflow-hidden border-b border-line">
        <Container className="pb-12 pt-14 sm:pt-20 lg:pt-28">
          <h1 className="text-h1">{intro?.title ?? "Work"}</h1>
          {intro?.body && <p className="mt-6 max-w-prose text-body-lg text-ink-2">{intro.body}</p>}
          {usedCategories.length > 1 && (
            <nav aria-label="Filter by category" className="mt-10 flex flex-wrap gap-2">
              {[undefined, ...usedCategories].map((c) => (
                <Link key={c ?? "all"} href={c ? `/portfolio?category=${encodeURIComponent(c)}` : "/portfolio"} aria-current={c === active ? "true" : undefined}
                  className={cn("rounded-sm border px-4 py-2 text-label transition-colors", c === active ? "border-ink bg-ink text-canvas" : "border-line-strong text-ink-2 hover:text-ink")}>
                  {c ?? "All"}
                </Link>
              ))}
            </nav>
          )}
        </Container>
      </section>
      {list.length > 0 && (
        <Container className="pt-6"><CarouselStacked slides={slides} label="Work" /></Container>
      )}
      <Section className="!pt-14 sm:!pt-20">
        <Container>
          {list.length === 0 ? (
            projects.length === 0
              ? <EmptyState title="New work is on its way" body="There's nothing published here yet. In the meantime, you can read about what I do or get in touch." action={{ href: "/about", label: "About me" }} secondary={{ href: "/contact", label: "Get in touch" }} />
              : <EmptyState title="Nothing here yet" body="This category doesn't have any published work yet. Check back soon, or look through everything." action={{ href: "/portfolio", label: "See all work" }} />
          ) : (
            <div className="grid gap-x-10 gap-y-20 md:grid-cols-2">
              {list.map((p, i) => (
                <ProjectCard key={p.id} project={p} index={i} size="md" className={i % 2 === 1 ? "md:mt-24" : ""} />
              ))}
            </div>
          )}
        </Container>
      </Section>
    </>
  );
}
