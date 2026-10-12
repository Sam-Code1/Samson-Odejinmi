import Link from "next/link";
import { Container, Thread } from "@/components/ui/Container";
import { site } from "@/lib/site";
import { getSocialLinks } from "@/lib/cms";

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

export async function AcademyFooter() {
  const socials = await getSocialLinks();
  return (
    <footer className="theme-night relative grain">
      <Thread />
      <Container className="py-16 sm:py-20">
        <div className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="text-h3">Fola Academy</p>
            <p className="mt-4 max-w-narrow text-body-sm text-ink-2">Practical creative education. Understand the idea, practise it, build something real.</p>
            <p className="mt-6 text-caption text-ink-3">By <Link href="/" className="underline decoration-line-strong underline-offset-4 hover:text-ink">{site.name}</Link></p>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-4 lg:col-span-8">
            <Col title="Fola Academy">
              <L href="/academy/courses">Courses</L>
              <L href="/academy#resources">Resources</L>
              <L href="/academy#how">Learning</L>
              <L href="/dashboard">Student portal</L>
            </Col>
            <Col title="About">
              <L href="/academy#instructor">Instructor</L>
              <L href="/academy#why">About Fola Academy</L>
              <L href="/about">Samson Odejinmi</L>
            </Col>
            <Col title="Connect">
              <L href="/contact">Contact</L>
              {socials.map((s) => <li key={s.id}><a href={s.url} rel="noopener noreferrer" target="_blank" className="text-ink-2 hover:text-ink">{s.label}</a></li>)}
            </Col>
            <Col title="Legal">
              <L href="/legal/privacy">Privacy</L>
              <L href="/legal/terms">Terms</L>
              <L href="/legal/refund-policy">Refund policy</L>
            </Col>
          </div>
        </div>
        <p className="mt-16 border-t border-line pt-6 text-caption text-ink-3">© {new Date().getFullYear()} {site.fullName}</p>
      </Container>
    </footer>
  );
}
