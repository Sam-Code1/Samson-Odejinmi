import Link from "next/link";
import { Container, Thread } from "@/components/ui/Container";
import { mainNav } from "@/lib/site";
import type { SiteSettings, SocialLink } from "@/lib/cms/types";

function Col({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-label text-ink-3">{title}</h2>
      <ul className="mt-5 space-y-3 text-body-sm">{children}</ul>
    </div>
  );
}
const L = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <li><Link href={href} className="text-ink-2 transition-colors hover:text-ink"><span className="link-line pb-0.5">{children}</span></Link></li>
);

export function Footer({ settings, socials }: { settings: SiteSettings; socials: SocialLink[] }) {
  return (
    <footer className="theme-night relative grain">
      <Thread />
      <Container className="py-16 sm:py-20">
        <div className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="text-h3">{settings.siteName}</p>
            {settings.footerText && <p className="mt-4 max-w-narrow text-body-sm text-ink-2">{settings.footerText}</p>}
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-7">
            <Col title="Site">{mainNav.map((n) => <L key={n.href} href={n.href}>{n.label}</L>)}</Col>
            <Col title="Academy">
              <L href="/academy/courses">Courses</L>
              <L href="/academy#how">How learning works</L>
              <L href="/dashboard">Student portal</L>
            </Col>
            {socials.length > 0 && (
              <Col title="Elsewhere">{socials.map((s) => <li key={s.id}><a href={s.url} rel="noopener noreferrer" target="_blank" className="text-ink-2 hover:text-ink">{s.label}</a></li>)}</Col>
            )}
          </div>
        </div>
        <div className="mt-16 flex flex-col gap-4 border-t border-line pt-6 text-caption text-ink-3 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} {settings.copyrightText ?? settings.fullName}</p>
          <ul className="flex gap-6">
            <li><Link href="/legal/privacy" className="hover:text-ink">Privacy</Link></li>
            <li><Link href="/legal/terms" className="hover:text-ink">Terms</Link></li>
          </ul>
        </div>
      </Container>
    </footer>
  );
}
