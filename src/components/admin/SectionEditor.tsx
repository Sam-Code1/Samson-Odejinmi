"use client";

import { saveSection } from "@/app/admin/actions/website";
import { AdminForm } from "./AdminForm";
import { FormSection, SelectInput, TextAreaInput, TextInput } from "./FormFields";
import { RepeaterField } from "./RepeaterField";
import { ImageField, type LibraryImage } from "./ImageField";
import type { SectionDef } from "@/lib/admin/sections";

export type SectionRow = {
  id: string; page: string; section_key: string; label: string; eyebrow: string | null; title: string | null; body: string | null;
  image_url: string | null; image_alt: string | null; cta_label: string | null; cta_href: string | null; cta2_label: string | null; cta2_href: string | null;
  items: { title?: string; body?: string; meta?: string }[]; settings: Record<string, unknown>; status: string; display_order: number; updated_at: string;
};

export function SectionEditor({ s, def, library, courses }: { s: SectionRow; def: SectionDef; library: LibraryImage[]; courses: { slug: string; title: string }[] }) {
  const has = (f: SectionDef["fields"][number]) => def.fields.includes(f);
  const L = def.labels ?? {};
  return (
    <AdminForm action={saveSection} submitLabel={`Save ${s.label.toLowerCase()}`} stickyBar={false}>
      <input type="hidden" name="sectionId" value={s.id} />
      <FormSection title="Content" description={def.help}>
        {has("eyebrow") && <TextInput label={L.eyebrow ?? "Eyebrow"} name="eyebrow" defaultValue={s.eyebrow ?? ""} maxLength={160} className="sm:col-span-2" />}
        {has("title") && (def.multilineTitle
          ? <TextAreaInput label={L.title ?? "Heading"} name="title" rows={3} defaultValue={s.title ?? ""} maxLength={400} className="sm:col-span-2" hint="Each line becomes its own line on the page." />
          : <TextAreaInput label={L.title ?? "Heading"} name="title" rows={2} defaultValue={s.title ?? ""} maxLength={400} className="sm:col-span-2" />)}
        {has("body") && <TextAreaInput label={L.body ?? "Text"} name="body" rows={6} defaultValue={s.body ?? ""} maxLength={6000} className="sm:col-span-2" hint="Plain text. A blank line starts a new paragraph. HTML isn't rendered." />}
        {has("image") && (
          <>
            <ImageField name="image" label="Image" current={s.image_url} library={library} />
            <TextInput label="Image description (alt text)" name="image_alt" defaultValue={s.image_alt ?? ""} maxLength={200} className="sm:col-span-2" hint="Describe the image for people using screen readers." />
          </>
        )}
        {def.settings?.includes("scene_url") && (
          <TextInput label="Spline scene URL" name="scene_url" defaultValue={typeof s.settings.scene_url === "string" ? s.settings.scene_url : ""} className="sm:col-span-2" placeholder="https://prod.spline.design/…/scene.splinecode" hint="Leave empty to show the static 3D artwork instead of the live scene." />
        )}
        {def.settings?.includes("featured_course_slug") && (
          <SelectInput label="Featured course" name="featured_course_slug" defaultValue={typeof s.settings.featured_course_slug === "string" ? s.settings.featured_course_slug : ""}
            hint="Only shown while the course is published." options={[{ value: "", label: "None" }, ...courses.map((c) => ({ value: c.slug, label: c.title }))]} />
        )}
      </FormSection>

      {(has("cta") || has("cta2")) && (
        <FormSection title="Buttons" description="Leave a label empty to hide that button. Links can be a site path (/contact) or a full https:// address.">
          {has("cta") && <><TextInput label={L.cta ? `${L.cta}: label` : "Primary button label"} name="cta_label" defaultValue={s.cta_label ?? ""} maxLength={60} /><TextInput label={L.cta ? `${L.cta}: link` : "Primary button link"} name="cta_href" defaultValue={s.cta_href ?? ""} maxLength={500} /></>}
          {has("cta2") && <><TextInput label="Secondary link label" name="cta2_label" defaultValue={s.cta2_label ?? ""} maxLength={60} /><TextInput label="Secondary link" name="cta2_href" defaultValue={s.cta2_href ?? ""} maxLength={500} /></>}
        </FormSection>
      )}

      {def.items && (
        <FormSection title={def.items.label}>
          <RepeaterField name="items" label={def.items.label} fields={def.items.fields} initial={Array.isArray(s.items) ? s.items : []} max={def.items.max} help={def.items.help} className="sm:col-span-2" />
        </FormSection>
      )}

      <FormSection title="Visibility">
        <SelectInput label="Status" name="status" defaultValue={s.status} hint="Draft sections are hidden from visitors but visible in preview."
          options={[{ value: "published", label: "Published (visible)" }, { value: "draft", label: "Draft (hidden, preview only)" }, { value: "archived", label: "Archived (hidden)" }]} />
      </FormSection>
    </AdminForm>
  );
}
