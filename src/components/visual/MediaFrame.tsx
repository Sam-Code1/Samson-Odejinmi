import Image from "next/image";
import { cn } from "@/lib/utils";
import { canOptimize } from "@/lib/cms/images";

type Img = { src: string; alt: string; width?: number; height?: number };

/** Placeholder art: three quiet variants so a grid of stand-ins doesn't look repeated. */
export function PlaceholderArt({ variant }: { variant: number }) {
  const v = variant % 3;
  const tint = variant % 4;
  return (
    <svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" aria-hidden className="absolute inset-0 h-full w-full">
      <defs>
        <linearGradient id={`pl${v}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "rgb(var(--blue-soft))", stopOpacity: 0.8 }} />
          <stop offset="1" style={{ stopColor: "rgb(var(--violet))", stopOpacity: 0.08 }} />
        </linearGradient>
      </defs>
      <rect width="800" height="600" className={`tint-${tint}`} />
      {v === 0 && (
        <>
          <rect x="250" y="190" width="170" height="280" className="art-left" />
          <polygon points="420,190 480,150 480,430 420,470" className="art-right" />
          <polygon points="420,190 480,150 480,430 420,470" fill={`url(#pl${v})`} />
          <polygon points="250,190 310,150 480,150 420,190" className="art-top" />
        </>
      )}
      {v === 1 && (
        <>
          <rect x="140" y="260" width="130" height="210" className="art-left" />
          <polygon points="270,260 320,228 320,438 270,470" className="art-right" />
          <polygon points="270,260 320,228 320,438 270,470" fill={`url(#pl${v})`} />
          <rect x="400" y="190" width="170" height="280" className="art-left" />
          <polygon points="570,190 630,150 630,430 570,470" className="art-right" />
          <polygon points="570,190 630,150 630,430 570,470" fill={`url(#pl${v})`} />
        </>
      )}
      {v === 2 && (
        <>
          <polygon points="400,170 520,240 400,310 280,240" className="art-top" />
          <polygon points="280,240 400,310 400,450 280,380" className="art-left" />
          <polygon points="400,310 520,240 520,380 400,450" className="art-right" />
          <polygon points="400,310 520,240 520,380 400,450" fill={`url(#pl${v})`} />
        </>
      )}
      <line x1="0" y1="470" x2="800" y2="470" className="art-floor" strokeWidth="1" opacity="0.3" />
    </svg>
  );
}

export function MediaFrame({
  image,
  ratio = "4/3",
  variant = 0,
  label,
  sizes = "(min-width: 1024px) 60vw, 100vw",
  priority,
  className,
}: {
  image?: Img;
  ratio?: string;
  variant?: number;
  label?: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full overflow-hidden rounded-sm bg-surface", className)} style={{ aspectRatio: ratio }}>
      {image ? (
        <Image src={image.src} alt={image.alt} fill sizes={sizes} priority={priority} unoptimized={!canOptimize(image.src)} className="object-cover transition-transform duration-slow ease-quiet group-hover:scale-[1.03]" />
      ) : (
        <>
          <PlaceholderArt variant={variant} />
          {label && <span className="absolute bottom-3 left-3 rounded-sm bg-canvas/80 px-2 py-1 text-meta text-ink-2 backdrop-blur">{label}</span>}
        </>
      )}
      <span aria-hidden className="thread-solid absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 transition-transform duration-slow ease-quiet group-hover:scale-x-100" />
    </div>
  );
}
