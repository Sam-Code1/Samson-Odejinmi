import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { OpenOnHash } from "@/components/showcase/OpenOnHash";
import { Container, Section, SectionHeader } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import { WorkflowStack } from "@/components/sections/StepStack";
import { MixTitle, Paragraphs } from "@/components/cms/RichText";
import { getPage, getServices } from "@/lib/cms";
import { buildMetadata } from "@/lib/cms/seo";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("services", {
    title: "Services",
    description: "3D animation, environment design, product visualisation, product animation, VFX, video editing, creative design and creative technology.",
    path: "/services",
  });
}

export default async function ServicesPage() {
  const [page, services] = await Promise.all([getPage("services"), getServices()]);
  const { intro, process, cta } = page;

  return (
    <>
      <section className="mesh grain relative overflow-hidden border-b border-line">
        <Container className="pb-14 pt-14 sm:pt-20 lg:pt-28">
          <h1 className="max-w-4xl text-h1 font-extrabold"><MixTitle text={intro?.title ?? "Services"} /></h1>
          {intro?.body && <p className="mt-6 max-w-prose text-body-lg text-ink-2">{intro.body}</p>}
        </Container>
      </section>

      <Section className="!py-0">
        <Container>
          {services.length === 0 ? (
            <EmptyState title="Services are being updated" body="The list of services is being refreshed. Get in touch and tell me what you're making." action={{ href: "/contact", label: "Get in touch" }} />
          ) : (
            <>
              <OpenOnHash />
              {/* One open at a time (native exclusive accordion); works without JavaScript. */}
              <ol className="border-t border-line">
                {services.map((s, i) => (
                  <li key={s.id}>
                    <details id={s.slug} name="services" className="group/svc scroll-mt-24 border-b border-line open:bg-tint-peach/60">
                      <summary className="grid min-h-[72px] cursor-pointer list-none grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 px-2 py-5 transition-colors duration-base ease-quiet hover:bg-tint-peach/70 sm:grid-cols-[3.5rem_minmax(0,1fr)_auto] sm:gap-4 sm:px-5 sm:py-6 [&::-webkit-details-marker]:hidden">
                        <span className="text-caption tabular-nums text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                        <h2 className="text-h4 font-extrabold uppercase tracking-[-0.01em] [overflow-wrap:anywhere] sm:text-h3 sm:font-extrabold">{s.name}</h2>
                        <ArrowDownRight aria-hidden className="h-5 w-5 text-ink-2 transition-transform duration-base ease-quiet group-open/svc:-rotate-90 group-hover/svc:text-ink" />
                      </summary>
                      <div className="grid gap-8 px-2 pb-10 pt-2 sm:px-5 lg:grid-cols-12 lg:pb-12">
                        <div className="lg:col-span-6 lg:col-start-2">
                          {s.deliverables.length > 0 ? (
                            <ul className="space-y-2.5 text-body-sm">
                              {s.deliverables.map((d) => (
                                <li key={d} className="flex gap-3"><span aria-hidden className="thread-solid mt-[0.7em] h-px w-4 shrink-0" /><span>{d}</span></li>
                              ))}
                            </ul>
                          ) : s.shortDescription && <p className="text-body-lg text-ink-2">{s.shortDescription}</p>}
                          {s.process.length > 0 && (
                            <ol className="mt-6 space-y-1 text-body-sm text-ink-2">
                              {s.process.map((p, n) => <li key={p}><span className="tabular-nums text-ink-3">{String(n + 1).padStart(2, "0")}</span> &nbsp;{p}</li>)}
                            </ol>
                          )}
                        </div>
                        <div className="lg:col-span-5">
                          {s.deliverables.length > 0 && s.shortDescription && <p className="text-body text-ink-2">{s.shortDescription}</p>}
                          <Paragraphs text={s.fullDescription} className="mt-4 space-y-4 text-body-sm text-ink-2 first:mt-0" />
                          {s.tools.length > 0 && <p className="mt-5 text-caption text-ink-3">Tools: {s.tools.join(", ")}</p>}
                          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                            {s.relatedCategory && (
                              <Link href={`/portfolio?category=${encodeURIComponent(s.relatedCategory)}`} className="inline-flex min-h-[44px] items-center gap-2 rounded bg-ink px-5 text-label text-canvas hover:bg-ink/90">
                                View projects <ArrowUpRight aria-hidden className="h-4 w-4" />
                              </Link>
                            )}
                            {s.ctaLabel && s.ctaHref && <Link href={s.ctaHref} className="inline-flex min-h-[44px] items-center text-label"><span className="link-line pb-1">{s.ctaLabel}</span></Link>}
                          </div>
                        </div>
                      </div>
                    </details>
                  </li>
                ))}
              </ol>
            </>
          )}
        </Container>
      </Section>

      {process && process.items.length > 0 && (
        <Section tone="blue">
          <Container>
            <div className="grid items-center gap-14 lg:grid-cols-12">
              <div className="lg:col-span-5">
                {process.title && <SectionHeader title={process.title} intro={process.body ?? undefined} />}
                <ol className="mt-8 space-y-2 text-body-sm text-ink-2">
                  {process.items.map((p, i) => <li key={`${p.title}-${i}`}><span className="tabular-nums text-ink-3">{String(i + 1).padStart(2, "0")}</span> &nbsp;{p.title}</li>)}
                </ol>
              </div>
              <div className="flex justify-center pb-6 lg:col-span-7"><WorkflowStack steps={process.items} /></div>
            </div>
          </Container>
        </Section>
      )}

      {cta?.title && (
        <Section>
          <Container className="flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-end">
            <div>
              <h2 className="max-w-3xl text-h1">{cta.title}</h2>
              <Paragraphs text={cta.body} className="mt-5 max-w-prose text-body-lg text-ink-2" />
            </div>
            {cta.cta?.label && <Button href={cta.cta.href} size="lg">{cta.cta.label}</Button>}
          </Container>
        </Section>
      )}
    </>
  );
}
