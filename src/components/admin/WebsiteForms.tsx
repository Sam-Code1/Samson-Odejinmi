"use client";

import {
  addGalleryImage, createProject, createService, saveContactSettings, saveProject, saveSeoEntry, saveService, saveSiteSettings, saveSocialLink, updateGalleryImage, updateMediaDetails,
} from "@/app/admin/actions/website";
import { AdminForm } from "./AdminForm";
import { CheckboxInput, FormSection, SelectInput, TextAreaInput, TextInput } from "./FormFields";
import { ImageField, type LibraryImage } from "./ImageField";
import { RepeaterField } from "./RepeaterField";
import { GALLERY_CATEGORIES } from "@/lib/gallery-categories";

// ───────────── contact + site settings ─────────────
export type ContactSettings = {
  contact_email: string | null; availability_message: string | null; response_expectation: string | null; location_text: string | null;
  /** Present only once migration 0007 has run. */
  whatsapp_number?: string | null; whatsapp_message?: string | null;
};

/** WhatsApp fields, rendered only when the columns exist (migration 0007). */
function WhatsappFields({ s }: { s: ContactSettings }) {
  if (!("whatsapp_number" in s)) return <p className="text-caption text-ink-3 sm:col-span-2">WhatsApp button: run supabase/migrations/0007_showcase.sql to turn this on.</p>;
  return (
    <>
      <TextInput label="WhatsApp number (optional)" name="whatsapp_number" type="tel" defaultValue={s.whatsapp_number ? `+${s.whatsapp_number}` : ""} maxLength={40}
        hint="With country code, e.g. +234 801 234 5678. Leave empty to hide every WhatsApp button." />
      <TextInput label="WhatsApp starting message (optional)" name="whatsapp_message" defaultValue={s.whatsapp_message ?? ""} maxLength={300}
        hint="Pre-filled in the chat, e.g. “Hi Samson, I'd like to talk about a project.”" />
    </>
  );
}

export function ContactSettingsForm({ s }: { s: ContactSettings }) {
  return (
    <AdminForm action={saveContactSettings} submitLabel="Save contact details" stickyBar={false}>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput label="Contact email" name="contact_email" type="email" required defaultValue={s.contact_email ?? ""} hint="Shown on the contact page as the direct email link." />
        <TextInput label="Availability message" name="availability_message" defaultValue={s.availability_message ?? ""} maxLength={200} hint="Optional, e.g. “Taking on new projects from March”. Leave empty to hide." />
        <TextInput label="Response expectation" name="response_expectation" defaultValue={s.response_expectation ?? ""} maxLength={200} hint="Shown after someone sends a message." />
        <TextInput label="General location (optional)" name="location_text" defaultValue={s.location_text ?? ""} maxLength={120} hint="Only if you want it public, e.g. a city or “Remote”." />
        <WhatsappFields s={s} />
      </div>
    </AdminForm>
  );
}

export type SiteSettingsRow = ContactSettings & {
  site_name: string; full_name: string; job_title: string | null; site_description: string | null; default_seo_title: string | null; default_seo_description: string | null;
  logo_url: string | null; favicon_url: string | null; default_og_image: string | null; footer_text: string | null; copyright_text: string | null;
};

export function SiteSettingsForm({ s, library }: { s: SiteSettingsRow; library: LibraryImage[] }) {
  return (
    <AdminForm action={saveSiteSettings} submitLabel="Save site settings">
      <FormSection title="Identity">
        <TextInput label="Site name" name="site_name" required defaultValue={s.site_name} maxLength={80} hint="Shown in the navigation, footer and browser tab." />
        <TextInput label="Full name" name="full_name" required defaultValue={s.full_name} maxLength={120} />
        <TextInput label="Role / job title" name="job_title" defaultValue={s.job_title ?? ""} maxLength={120} hint="Used in search-engine structured data." />
        <TextAreaInput label="Site description" name="site_description" rows={2} defaultValue={s.site_description ?? ""} maxLength={300} />
        <ImageField name="logo_url" label="Logo (optional)" current={s.logo_url} library={library} hint="Shown next to the site name. Leave empty for text only." />
        <ImageField name="favicon_url" label="Favicon (optional)" current={s.favicon_url} library={library} hint="A square PNG. Leave empty to use the built-in icon." />
      </FormSection>
      <FormSection title="Search and sharing defaults" description="Used when a page has no SEO of its own (Website → SEO).">
        <TextInput label="Default SEO title" name="default_seo_title" defaultValue={s.default_seo_title ?? ""} maxLength={80} className="sm:col-span-2" />
        <TextAreaInput label="Default SEO description" name="default_seo_description" rows={2} defaultValue={s.default_seo_description ?? ""} maxLength={200} className="sm:col-span-2" />
        <ImageField name="default_og_image" label="Default social image" current={s.default_og_image} library={library} hint="1200 × 630 works best. Leave empty to use the generated image." />
      </FormSection>
      <FormSection title="Contact">
        <TextInput label="Contact email" name="contact_email" type="email" required defaultValue={s.contact_email ?? ""} />
        <TextInput label="Response expectation" name="response_expectation" defaultValue={s.response_expectation ?? ""} maxLength={200} />
        <TextInput label="Availability message" name="availability_message" defaultValue={s.availability_message ?? ""} maxLength={200} />
        <TextInput label="General location" name="location_text" defaultValue={s.location_text ?? ""} maxLength={120} />
        <WhatsappFields s={s} />
      </FormSection>
      <FormSection title="Footer">
        <TextAreaInput label="Footer text" name="footer_text" rows={2} defaultValue={s.footer_text ?? ""} maxLength={300} className="sm:col-span-2" />
        <TextInput label="Copyright name" name="copyright_text" defaultValue={s.copyright_text ?? ""} maxLength={120} hint="Shown as “© year …”." />
      </FormSection>
    </AdminForm>
  );
}

// ───────────── social links ─────────────
export const PLATFORM_OPTIONS = [
  ["linkedin", "LinkedIn"], ["x", "X"], ["instagram", "Instagram"], ["youtube", "YouTube"], ["pinterest", "Pinterest"], ["github", "GitHub"], ["behance", "Behance"],
  ["artstation", "ArtStation"], ["vimeo", "Vimeo"], ["tiktok", "TikTok"], ["facebook", "Facebook"], ["email", "Email"], ["website", "Website"], ["other", "Other"],
].map(([value, label]) => ({ value, label }));

export type SocialRow = { id: string; platform: string; label: string; url: string; active: boolean };

export function SocialLinkForm({ link }: { link?: SocialRow }) {
  return (
    <AdminForm action={saveSocialLink} submitLabel={link ? "Save" : "Add link"} stickyBar={false}>
      {link && <input type="hidden" name="linkId" value={link.id} />}
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr_2fr_auto] sm:items-end">
        <SelectInput label="Platform" name="platform" defaultValue={link?.platform ?? "linkedin"} options={PLATFORM_OPTIONS} />
        <TextInput label="Label" name="label" required defaultValue={link?.label ?? ""} maxLength={60} />
        <TextInput label="Profile URL (or email)" name="url" required defaultValue={link?.url.replace(/^mailto:/, "") ?? ""} maxLength={500} />
        <CheckboxInput label="Show" name="active" defaultChecked={link?.active ?? true} className="pb-2" />
      </div>
    </AdminForm>
  );
}

// ───────────── SEO ─────────────
export type SeoRow = { route_key: string; seo_title: string | null; seo_description: string | null; og_title: string | null; og_description: string | null; og_image: string | null; canonical_url: string | null; noindex: boolean };

export function SeoForm({ row, library }: { row: SeoRow; library: LibraryImage[] }) {
  return (
    <AdminForm action={saveSeoEntry} submitLabel="Save SEO" stickyBar={false}>
      <input type="hidden" name="route_key" value={row.route_key} />
      <div className="grid gap-5 sm:grid-cols-2">
        <TextInput label="SEO title" name="seo_title" defaultValue={row.seo_title ?? ""} maxLength={70} hint="Up to about 60 characters. Leave empty for the default." />
        <TextInput label="Social title (Open Graph)" name="og_title" defaultValue={row.og_title ?? ""} maxLength={90} hint="Defaults to the SEO title." />
        <TextAreaInput label="Meta description" name="seo_description" rows={2} defaultValue={row.seo_description ?? ""} maxLength={170} hint="Up to about 155 characters." />
        <TextAreaInput label="Social description" name="og_description" rows={2} defaultValue={row.og_description ?? ""} maxLength={200} />
        <ImageField name="og_image" label="Social image" current={row.og_image} library={library} />
        <TextInput label="Canonical URL (optional)" name="canonical_url" defaultValue={row.canonical_url ?? ""} maxLength={500} hint="Only if this page's main address is elsewhere." />
        <CheckboxInput label="Hide from search engines (noindex)" name="noindex" defaultChecked={row.noindex} hint="The page stays public, but asks search engines not to list it." className="self-end pb-2" />
      </div>
    </AdminForm>
  );
}

// ───────────── portfolio ─────────────
export const PROJECT_STATUS = ["Personal Study", "Concept", "In Progress", "Completed", "Client Work", "Placeholder"].map((v) => ({ value: v, label: v }));
export const PROJECT_TYPES = ["", "Personal Project", "Study Project", "Concept", "Experiment", "Collaboration", "Client Work"].map((v) => ({ value: v, label: v || "Not set" }));

export function NewProjectForm() {
  return (
    <AdminForm action={createProject} submitLabel="Create draft project">
      <FormSection title="New project" description="Start with a title. It's saved as a draft, so nothing is public until you publish it.">
        <TextInput label="Title" name="title" required maxLength={140} className="sm:col-span-2" hint="Wrap a word in *asterisks* to set it in italic serif on the site, e.g. Habit *flow* tracker." />
        <TextInput label="Slug" name="slug" maxLength={80} hint="Used in the URL. Generated from the title if empty." />
        <SelectInput label="Project type" name="project_type" options={PROJECT_TYPES} hint="Be honest: “Client Work” only if it was." />
        <SelectInput label="Status label" name="project_status" defaultValue="Personal Study" options={PROJECT_STATUS} />
      </FormSection>
    </AdminForm>
  );
}

export type ProjectRow = {
  id: string; slug: string; title: string; short_description: string | null; description: string | null; challenge: string | null; approach: string | null; outcome: string | null;
  process: { title?: string; body?: string }[]; categories: string[]; services: string[]; tools: string[]; cover_image_url: string | null; cover_image_alt: string | null;
  video_id: string | null; project_url: string | null; external_url: string | null; year: number | null; role: string | null; client: string | null;
  project_type: string | null; project_status: string; is_placeholder: boolean; featured: boolean; status: string; seo_title: string | null; seo_description: string | null;
  /** Migration 0017 (undefined before it runs). */
  discipline?: string | null; live_preview?: boolean; site_preview?: { embeddable?: boolean } | null; updated_at?: string;
};

export function ProjectForm({ p, library, categorySuggestions }: { p: ProjectRow; library: LibraryImage[]; categorySuggestions: string[] }) {
  const published = p.status === "published";
  return (
    <AdminForm action={saveProject} saveIntent="save" submitLabel={published ? "Save changes" : "Save draft"}
      extra={published
        ? <button type="submit" name="intent" value="unpublish" className="h-10 rounded border border-line-strong px-4 text-label hover:border-ink">Unpublish</button>
        : <button type="submit" name="intent" value="publish" className="h-10 rounded border border-blue/50 px-4 text-label text-blue hover:bg-blue/10">Save and publish</button>}>
      <input type="hidden" name="projectId" value={p.id} />
      <FormSection title="Basics">
        <TextInput label="Title" name="title" required defaultValue={p.title} maxLength={140} className="sm:col-span-2" hint="Wrap a word in *asterisks* to set it in italic serif on the site, e.g. Habit *flow* tracker." />
        <TextInput label="Slug" name="slug" required defaultValue={p.slug} maxLength={80} hint={`Public URL: /portfolio/${p.slug}`} />
        <TextInput label="Categories" name="categories" defaultValue={p.categories.join(", ")} hint={`Comma-separated. The first is the main category.${categorySuggestions.length ? ` In use: ${categorySuggestions.join(", ")}.` : ""}`} />
        {p.discipline !== undefined && <SelectInput label="Show on the Work page under" name="discipline" defaultValue={p.discipline ?? ""} options={[{ value: "", label: "Not on the Work page" }, ...GALLERY_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))]} hint="Published projects appear in this discipline on /work and the homepage, linking to this case study." />}
        <TextAreaInput label="Short description" name="short_description" rows={2} defaultValue={p.short_description ?? ""} maxLength={300} className="sm:col-span-2" hint="One or two lines, shown on cards." />
        <ImageField name="cover" label="Cover image" current={p.cover_image_url} library={library} />
        <TextInput label="Cover image description (alt text)" name="cover_image_alt" defaultValue={p.cover_image_alt ?? ""} maxLength={200} className="sm:col-span-2" />
      </FormSection>

      <FormSection title="Case study" description="Only sections with content are shown on the project page.">
        <TextAreaInput label="Overview" name="description" rows={5} defaultValue={p.description ?? ""} maxLength={8000} className="sm:col-span-2" />
        <TextAreaInput label="Challenge" name="challenge" rows={4} defaultValue={p.challenge ?? ""} maxLength={4000} className="sm:col-span-2" />
        <TextAreaInput label="Approach" name="approach" rows={4} defaultValue={p.approach ?? ""} maxLength={4000} className="sm:col-span-2" />
        <RepeaterField name="process" label="Process steps" fields={{ title: "Step", body: "What happened" }} initial={p.process ?? []} max={12} className="sm:col-span-2" />
        <TextAreaInput label="Outcome" name="outcome" rows={4} defaultValue={p.outcome ?? ""} maxLength={4000} className="sm:col-span-2" hint="What came out of it. No invented results or metrics." />
      </FormSection>

      <FormSection title="Project information">
        <SelectInput label="Project type" name="project_type" defaultValue={p.project_type ?? ""} options={PROJECT_TYPES} />
        <SelectInput label="Status label" name="project_status" defaultValue={p.project_status} options={PROJECT_STATUS} />
        <TextInput label="Year" name="year" inputMode="numeric" defaultValue={p.year ? String(p.year) : ""} maxLength={4} />
        <TextInput label="Role" name="role" defaultValue={p.role ?? ""} maxLength={120} />
        <TextInput label="Client (only if real)" name="client" defaultValue={p.client ?? ""} maxLength={120} hint="Leave empty for personal or study work." />
        <TextInput label="Services" name="services" defaultValue={p.services.join(", ")} hint="Comma-separated." />
        <TextInput label="Tools" name="tools" defaultValue={p.tools.join(", ")} hint="Comma-separated, e.g. Blender, DaVinci Resolve." />
        <TextInput label="YouTube video (optional)" name="video_input" defaultValue={p.video_id ?? ""} hint="Paste a YouTube link or the 11-character ID." />
        <TextInput label="Project URL" name="project_url" defaultValue={p.project_url ?? ""} placeholder="https://" />
        <TextInput label="External URL (e.g. ArtStation)" name="external_url" defaultValue={p.external_url ?? ""} placeholder="https://" />
      </FormSection>

      <FormSection title="Display">
        <CheckboxInput label="Show on homepage (Selected work)" name="featured" defaultChecked={p.featured} />
        <CheckboxInput label="This is a placeholder" name="is_placeholder" defaultChecked={p.is_placeholder} hint="Labels it clearly on the site and keeps it out of search engines." />
        {p.live_preview !== undefined && <><input type="hidden" name="live_preview_field" value="1" />
          <CheckboxInput label="Let visitors try the live website on the project page" name="live_preview" defaultChecked={p.live_preview} disabled={p.site_preview?.embeddable === false}
            hint={p.site_preview?.embeddable === false ? "This site blocks being shown inside other pages, so visitors get scrolling screenshots and a link instead." : "Opens the real site inside a browser frame when a visitor asks for it."} /></>}
      </FormSection>

      <FormSection title="SEO">
        <TextInput label="SEO title" name="seo_title" defaultValue={p.seo_title ?? ""} maxLength={70} hint="Defaults to the project title." />
        <TextAreaInput label="Meta description" name="seo_description" rows={2} defaultValue={p.seo_description ?? ""} maxLength={170} hint="Defaults to the short description." />
      </FormSection>
    </AdminForm>
  );
}

export function GalleryAddForm({ projectId, library }: { projectId: string; library: LibraryImage[] }) {
  return (
    <AdminForm action={addGalleryImage} submitLabel="Add to gallery" stickyBar={false}>
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid gap-5 sm:grid-cols-2">
        <ImageField name="gallery" label="Image" current={null} library={library} />
        <TextInput label="Alt text" name="alt" required maxLength={200} />
        <TextInput label="Caption (optional)" name="caption" maxLength={300} />
      </div>
    </AdminForm>
  );
}

export function GalleryItemForm({ item }: { item: { id: string; alt: string; caption: string | null } }) {
  return (
    <AdminForm action={updateGalleryImage} submitLabel="Save" stickyBar={false}>
      <input type="hidden" name="mediaId" value={item.id} />
      <TextInput label="Alt text" name="alt" required defaultValue={item.alt} maxLength={200} />
      <TextInput label="Caption" name="caption" defaultValue={item.caption ?? ""} maxLength={300} />
    </AdminForm>
  );
}

// ───────────── services ─────────────
export function NewServiceForm() {
  return (
    <AdminForm action={createService} submitLabel="Create draft service">
      <FormSection title="New service" description="Only add services you actually offer. It's saved as a draft.">
        <TextInput label="Name" name="name" required maxLength={100} />
        <TextInput label="Slug" name="slug" maxLength={80} hint="Generated from the name if empty." />
      </FormSection>
    </AdminForm>
  );
}

export type ServiceRow = {
  id: string; slug: string; name: string; short_description: string | null; full_description: string | null; icon: string | null; image_url: string | null;
  deliverables: string[]; process: string[]; tools: string[]; related_category: string | null; cta_label: string | null; cta_href: string | null; featured: boolean; status: string;
};

export function ServiceForm({ s, library, categories }: { s: ServiceRow; library: LibraryImage[]; categories: string[] }) {
  const published = s.status === "published";
  return (
    <AdminForm action={saveService} saveIntent="save" submitLabel={published ? "Save changes" : "Save draft"}
      extra={published
        ? <button type="submit" name="intent" value="unpublish" className="h-10 rounded border border-line-strong px-4 text-label hover:border-ink">Unpublish</button>
        : <button type="submit" name="intent" value="publish" className="h-10 rounded border border-blue/50 px-4 text-label text-blue hover:bg-blue/10">Save and publish</button>}>
      <input type="hidden" name="serviceId" value={s.id} />
      <FormSection title="Service">
        <TextInput label="Name" name="name" required defaultValue={s.name} maxLength={100} />
        <TextInput label="Slug" name="slug" required defaultValue={s.slug} maxLength={80} hint={`Anchor on the services page: /services#${s.slug}`} />
        <TextAreaInput label="Short description" name="short_description" rows={2} defaultValue={s.short_description ?? ""} maxLength={400} className="sm:col-span-2" />
        <TextAreaInput label="Full description (optional)" name="full_description" rows={5} defaultValue={s.full_description ?? ""} maxLength={6000} className="sm:col-span-2" />
        <TextAreaInput label="What it involves / deliverables" name="deliverables" rows={4} defaultValue={s.deliverables.join("\n")} hint="One per line." />
        <TextAreaInput label="Process (optional)" name="process" rows={4} defaultValue={s.process.join("\n")} hint="One step per line." />
        <TextInput label="Tools" name="tools" defaultValue={s.tools.join(", ")} hint="Comma-separated." />
        <SelectInput label="Related portfolio category" name="related_category" defaultValue={s.related_category ?? ""} hint="Adds a “Related work” link." options={[{ value: "", label: "None" }, ...[...new Set([...(s.related_category ? [s.related_category] : []), ...categories])].map((c) => ({ value: c, label: c }))]} />
        <TextInput label="Icon name (optional)" name="icon" defaultValue={s.icon ?? ""} maxLength={40} hint="Reserved for a future icon set; not shown yet." />
        <ImageField name="image" label="Image (optional)" current={s.image_url} library={library} />
      </FormSection>
      <FormSection title="Call to action (optional)">
        <TextInput label="Label" name="cta_label" defaultValue={s.cta_label ?? ""} maxLength={60} />
        <TextInput label="Link" name="cta_href" defaultValue={s.cta_href ?? ""} maxLength={500} placeholder="/contact" />
        <CheckboxInput label="Featured" name="featured" defaultChecked={s.featured} hint="Stored for future highlighting." />
      </FormSection>
    </AdminForm>
  );
}

// ───────────── media ─────────────
export function MediaDetailsForm({ m }: { m: { id: string; alt_text: string | null; caption: string | null } }) {
  return (
    <AdminForm action={updateMediaDetails} submitLabel="Save" stickyBar={false}>
      <input type="hidden" name="mediaId" value={m.id} />
      <TextInput label="Alt text" name="alt_text" defaultValue={m.alt_text ?? ""} maxLength={200} />
      <TextInput label="Caption" name="caption" defaultValue={m.caption ?? ""} maxLength={300} />
    </AdminForm>
  );
}
