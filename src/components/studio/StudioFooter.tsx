import Link from "next/link";
import { legalLinks } from "@/lib/site";
import { ArrowUpRight } from "lucide-react";
import type { SiteSettings, SocialLink } from "@/lib/cms/types";
import { GALLERY_CATEGORIES } from "@/lib/gallery-categories";

/** Main-site footer: a closing statement, the disciplines, the studio links, socials. Always on the dark ground. */
export function StudioFooter({ settings, socials }: { settings: SiteSettings; socials: SocialLink[] }) {
  return (
    <footer className="theme-night border-t border-line bg-canvas">
      <div className="mx-auto max-w-[1440px] px-4 pb-10 pt-20 sm:px-6 lg:px-10">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="fa-label">Let&apos;s make something</p>
            <Link href="/contact" className="group mt-4 inline-block text-[clamp(2.25rem,1.4rem+3.6vw,4.5rem)] font-extrabold leading-[0.95] tracking-[-0.045em]">
              Have an idea? <span className="st-em">Let&apos;s build it.</span>
              <ArrowUpRight aria-hidden className="ml-2 inline h-[0.7em] w-[0.7em] align-baseline transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1" />
            </Link>
            {settings.contactEmail && <p className="mt-6"><a href={`mailto:${settings.contactEmail}`} className="text-body-lg text-ink-2 underline-offset-4 hover:text-ink hover:underline">{settings.contactEmail}</a></p>}
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-6">
            <div>
              <h2 className="fa-label">Work</h2>
              <ul className="mt-4 space-y-2.5 text-sm">{GALLERY_CATEGORIES.map((c) => <li key={c.id}><Link href={`/work?c=${c.id}`} className="text-ink-2 hover:text-ink">{c.label}</Link></li>)}</ul>
            </div>
            <div>
              <h2 className="fa-label">Studio</h2>
              <ul className="mt-4 space-y-2.5 text-sm">
                {[["/about", "About"], ["/services", "Services"], ["/portfolio", "Case studies"], ["/academy", "Fola Academy"], ["/academy/books", "Books"], ["/contact", "Contact"]].map(([h, l]) => <li key={h}><Link href={h} className="text-ink-2 hover:text-ink">{l}</Link></li>)}
              </ul>
            </div>
            {socials.length > 0 && (
              <div>
                <h2 className="fa-label">Elsewhere</h2>
                <ul className="mt-4 space-y-2.5 text-sm">{socials.map((s) => <li key={s.id}><a href={s.url} target="_blank" rel="noopener noreferrer" className="text-ink-2 hover:text-ink">{s.label}</a></li>)}</ul>
              </div>
            )}
          </div>
        </div>
        <div className="mt-16 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="fa-label">© {new Date().getFullYear()} {settings.fullName}</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-3">{legalLinks.map((l) => <li key={l.href}><Link href={l.href} className="hover:text-ink">{l.label}</Link></li>)}</ul>
        </div>
      </div>
    </footer>
  );
}
