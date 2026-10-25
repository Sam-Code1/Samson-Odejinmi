import Link from "next/link";
import { cn } from "@/lib/utils";
import { legalLinks, site } from "@/lib/site";
import { getSocialLinks } from "@/lib/cms";
import { FolaLogo, Pathway } from "./Brand";
import { AcademyHeader } from "./AcademyHeader";

/** Academy layout grid (§16): content-max 1200px with 24px gutters (16px on mobile). */
export function FaContainer({ className, children, as: As = "div" }: { className?: string; children: React.ReactNode; as?: "div" | "section" | "header" | "footer" | "nav" }) {
  return <As className={cn("mx-auto w-full max-w-[1248px] px-4 sm:px-6", className)}>{children}</As>;
}

/** Section separated by a hairline (§16 "sections separated by hairlines"). */
export function FaSection({ id, className, children, label, title, intro, action, night = false }: {
  id?: string; className?: string; children?: React.ReactNode; label?: string; title?: React.ReactNode; intro?: React.ReactNode; action?: React.ReactNode; night?: boolean;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24 border-t border-line py-16 sm:py-24", night && "theme-night bg-canvas", className)}>
      <FaContainer>
        {(label || title) && (
          <div className="mb-10 flex flex-col gap-6 sm:mb-14 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl">
              {label && <p className="fa-label">{label}</p>}
              {title && <h2 className="mt-3 text-h2">{title}</h2>}
              {intro && <p className="mt-4 max-w-prose text-body-lg text-ink-2">{intro}</p>}
            </div>
            {action}
          </div>
        )}
        {children}
      </FaContainer>
    </section>
  );
}

const NAV = [
  { href: "/academy/courses", label: "Courses" },
  { href: "/academy/books", label: "Books" },
  { href: "/academy#about", label: "About" },
];

/** Every Academy page: header, main, footer. The caller wraps it in academyRoot() (fonts + .fa-root theme). */
export function AcademyChrome({ children, hideBooks = false }: { children: React.ReactNode; hideBooks?: boolean }) {
  return (
    <>
      <AcademyHeader nav={hideBooks ? NAV.filter((n) => n.href !== "/academy/books") : NAV} />
      <main id="main">{children}</main>
      <AcademyFooter />
    </>
  );
}

async function AcademyFooter() {
  const socials = await getSocialLinks();
  const col = (title: string, links: { href: string; label: string; external?: boolean }[]) => (
    <div>
      <h2 className="fa-label">{title}</h2>
      <ul className="mt-5 space-y-3 text-body-sm">
        {links.map((l) => (
          <li key={l.href}>{l.external
            ? <a href={l.href} rel="noopener noreferrer" target="_blank" className="text-ink-2 transition-colors hover:text-ink">{l.label}</a>
            : <Link href={l.href} className="text-ink-2 transition-colors hover:text-ink">{l.label}</Link>}</li>
        ))}
      </ul>
    </div>
  );
  return (
    <footer className="theme-night border-t border-line bg-canvas">
      <FaContainer className="py-16 sm:py-20">
        <div className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <FolaLogo descriptor />
            <p className="mt-6 max-w-sm text-body-sm text-ink-2">Learn the craft. Understand the tools. Build with purpose.</p>
            <Pathway className="mt-6 max-w-[16rem]" />
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4 lg:col-span-8">
            {col("Learn", [{ href: "/academy/courses", label: "Courses" }, { href: "/academy/books", label: "Books" }, { href: "/dashboard", label: "My learning" }, { href: "/library", label: "Library" }, { href: "/affiliates", label: "Affiliate programme" }])}
            {col("Academy", [{ href: "/academy#about", label: "About" }, { href: "/academy#instructor", label: "Instructor" }, { href: "/verify", label: "Verify a certificate" }, { href: "/", label: site.name }])}
            {col("Connect", [{ href: "/contact", label: "Contact" }, ...socials.map((s) => ({ href: s.url, label: s.label, external: true }))])}
            {col("Legal", [...legalLinks, { href: "/order/access", label: "Find my purchase" }])}
          </div>
        </div>
        <div className="mt-16 flex flex-col gap-3 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="fa-label">© {new Date().getFullYear()} Fola Academy · {site.fullName}</p>
          <p className="fa-label">Creative &amp; technical education</p>
        </div>
      </FaContainer>
    </footer>
  );
}
