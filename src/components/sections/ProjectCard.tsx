import Link from "next/link";
import type { PortfolioProject } from "@/lib/cms/types";
import { MediaFrame } from "@/components/visual/MediaFrame";
import { ImageReveal } from "@/components/ui/Motion";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

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

export function ProjectCard({ project, index, size = "md", className }: { project: PortfolioProject; index: number; size?: "lg" | "md" | "sm"; className?: string }) {
  const ratio = size === "lg" ? "16/11" : size === "md" ? "4/3" : "4/5";
  return (
    <article className={cn("group", className)}>
      <Link href={`/portfolio/${project.slug}`} className="block">
        <ImageReveal>
          <MediaFrame image={project.coverImage} ratio={ratio} variant={index} label={project.placeholder ? "Placeholder · image to come" : undefined} sizes={size === "lg" ? "(min-width: 1024px) 62vw, 100vw" : "(min-width: 1024px) 34vw, 100vw"} />
        </ImageReveal>
        <div className="mt-5 grid grid-cols-[auto_1fr] gap-x-5">
          <span className="pt-1 text-caption tabular-nums text-ink-3">{String(index + 1).padStart(2, "0")}</span>
          <div>
            <h3 className={cn(size === "lg" ? "text-h2" : "text-h3")}>
              <span className="link-line pb-1">{project.title}</span>
            </h3>
            {project.shortDescription && <p className="mt-2 max-w-narrow text-body-sm text-ink-2">{project.shortDescription}</p>}
            <div className="mt-4"><ProjectMeta project={project} /></div>
          </div>
        </div>
      </Link>
    </article>
  );
}
