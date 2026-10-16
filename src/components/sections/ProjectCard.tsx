import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { PortfolioProject } from "@/lib/cms/types";
import { MediaFrame } from "@/components/visual/MediaFrame";
import { ImageReveal } from "@/components/ui/Motion";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { MixTitle } from "@/components/cms/RichText";

export function ProjectMeta({ project }: { project: PortfolioProject }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-caption text-ink-3">
      {project.category && <span>{project.category}</span>}
      {project.year && <span>{project.year}</span>}
      {project.placeholder ? <Badge tone="accent">Placeholder</Badge> : project.projectStatus !== "Completed" && <Badge>{project.projectStatus}</Badge>}
      {project.status === "draft" && <Badge tone="accent">Draft preview</Badge>}
    </div>
  );
}

/**
 * Product-shot card: the cover floats in a spotlit night stage (light cone above, shadow on the floor), with a heavy
 * title whose *marked* words turn italic serif. Hover lifts the shot slightly.
 */
export function ProjectCard({ project, index, size = "md", className }: { project: PortfolioProject; index: number; size?: "lg" | "md" | "sm"; className?: string }) {
  const ratio = size === "lg" ? "16/11" : size === "md" ? "4/3" : "4/5";
  return (
    <article className={cn("group", className)}>
      <Link href={`/portfolio/${project.slug}`} className="block">
        <div className="theme-night spot-stage relative overflow-hidden rounded-xl border border-line px-5 pb-9 pt-11 sm:px-9 sm:pb-12 sm:pt-14">
          <span aria-hidden className="absolute left-5 top-4 text-caption tabular-nums text-ink-3 sm:left-6 sm:top-5">{String(index + 1).padStart(2, "0")}</span>
          <ImageReveal>
            <div className="mx-auto w-full max-w-[34rem] transition-transform duration-slow ease-quiet group-hover:-translate-y-1.5 group-hover:scale-[1.015]">
              <MediaFrame image={project.coverImage} ratio={ratio} variant={index} label={project.placeholder ? "Placeholder · image to come" : undefined}
                sizes={size === "lg" ? "(min-width: 1024px) 56vw, 100vw" : "(min-width: 1024px) 32vw, 100vw"}
                className="shadow-[0_44px_60px_-34px_rgb(0_0_0/0.85)]" />
            </div>
          </ImageReveal>
        </div>
        <div className="mt-6">
          <h3 className={cn("font-extrabold leading-[1.02] tracking-[-0.03em]", size === "lg" ? "text-h2" : "text-h3")}>
            <MixTitle text={project.titleDisplay ?? project.title} caps />
          </h3>
          {project.shortDescription && <p className="mt-3 max-w-narrow text-body-sm text-ink-2">{project.shortDescription}</p>}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
            <ProjectMeta project={project} />
            <span className="inline-flex items-center gap-1.5 text-label"><span className="link-line pb-0.5">View project</span><ArrowUpRight aria-hidden className="h-4 w-4 transition-transform duration-base ease-quiet group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></span>
          </div>
        </div>
      </Link>
    </article>
  );
}
