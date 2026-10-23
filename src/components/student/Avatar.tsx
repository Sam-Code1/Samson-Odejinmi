/* eslint-disable @next/next/no-img-element -- avatars are small, already-sized public files; a plain img avoids the optimiser for blob previews */
import { cn } from "@/lib/utils";

/** Round profile photo, or initials on navy with the node colour. */
export function Avatar({ src, initials, size = 40, className }: { src: string | null; initials: string; size?: number; className?: string }) {
  return (
    <span className={cn("relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-surface font-semibold text-ink", className)} style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}>
      {src ? <img src={src} alt="" width={size} height={size} className="h-full w-full object-cover" /> : <span aria-hidden>{initials}</span>}
    </span>
  );
}
