import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { ContactForm } from "@/components/forms/ContactForm";
import { Paragraphs } from "@/components/cms/RichText";
import { getPage, getServices, getSiteSettings, getSocialLinks } from "@/lib/cms";
import { buildMetadata } from "@/lib/cms/seo";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata("contact", {
    title: "Contact",
    description: "Get in touch with Samson Odejinmi about 3D, animation, design or creative technology work.",
    path: "/contact",
  });
}

export default async function ContactPage() {
  const [page, settings, services, socials] = await Promise.all([getPage("contact"), getSiteSettings(), getServices(), getSocialLinks()]);
  const intro = page.intro;

  return (
    <Container className="grid gap-16 pb-8 pt-14 sm:pt-20 lg:grid-cols-12 lg:pt-28">
      <div className="lg:col-span-5">
        <h1 className="text-h1">{intro?.title ?? "Contact"}</h1>
        <Paragraphs text={intro?.body} className="mt-6 max-w-narrow space-y-4 text-body-lg text-ink-2" />
        {settings.availabilityMessage && (
          <p className="mt-6 flex items-center gap-3 text-body-sm text-ink-2"><span aria-hidden className="thread-solid h-px w-6" />{settings.availabilityMessage}</p>
        )}
        <p className="mt-10 text-caption text-ink-3">Prefer to write directly?</p>
        <a href={`mailto:${settings.contactEmail}`} className="mt-1 inline-flex min-h-[44px] max-w-full items-center break-all text-body"><span className="link-line pb-1">{settings.contactEmail}</span></a>
        {settings.locationText && <p className="mt-6 text-body-sm text-ink-3">{settings.locationText}</p>}
        {socials.length > 0 && (
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-label">
            {socials.map((l) => <li key={l.id}><a href={l.url} target="_blank" rel="noopener noreferrer" className="text-ink-2 hover:text-ink"><span className="link-line pb-0.5">{l.label}</span></a></li>)}
          </ul>
        )}
      </div>
      <div className="lg:col-span-6 lg:col-start-7">
        <ContactForm services={services.map((s) => s.name)} responseExpectation={settings.responseExpectation} />
      </div>
    </Container>
  );
}
