"use client";

import { saveShopSettings, createProduct, saveProduct, saveProductPrices, setBundleItems, setRelatedProducts, uploadProductFile } from "@/app/admin/actions/products";
import { AdminForm } from "./AdminForm";
import { CheckboxInput, FileInput, FormSection, SelectInput, TextAreaInput, TextInput } from "./FormFields";
import { RepeaterField } from "./RepeaterField";
import { ImageField, type LibraryImage } from "./ImageField";
import { useFieldError } from "./FormContext";

const TYPES = [
  { value: "ebook", label: "Ebook" }, { value: "guide", label: "Guide" }, { value: "template", label: "Template" },
  { value: "download", label: "Digital download" }, { value: "bundle", label: "Bundle" }, { value: "course", label: "Course (sell an existing course)" },
];

export function NewProductForm({ courses }: { courses: { id: string; title: string }[] }) {
  return (
    <AdminForm action={createProduct} submitLabel="Create draft product">
      <FormSection title="New product" description="It starts as a draft: nothing is public until you add a price (and file) and publish it.">
        <TextInput label="Name" name="name" required maxLength={160} className="sm:col-span-2" />
        <SelectInput label="Type" name="product_type" defaultValue="ebook" options={TYPES} />
        <TextInput label="Slug (optional)" name="slug" maxLength={80} hint="URL: /academy/shop/<slug>. Generated from the name if empty." />
        <SelectInput label="Course (for course products only)" name="course_id" defaultValue="" className="sm:col-span-2"
          hint="A course product sells the existing course: it uses the course's own page and prices, never a copy."
          options={[{ value: "", label: "Not a course product" }, ...courses.map((c) => ({ value: c.id, label: c.title }))]} />
      </FormSection>
    </AdminForm>
  );
}

export type ProductRow = {
  id: string; name: string; slug: string; product_type: string; status: string; short_description: string | null; description: string | null;
  cover_image: string | null; og_image: string | null; seo_title: string | null; seo_description: string | null; course_id: string | null;
  /** Shop details: present once migration 0009 has run. */
  display_order?: number; featured?: boolean; badge?: string | null; features?: string[]; faq?: { q: string; a: string }[];
  details?: { format?: string; length?: string; level?: string; includes_note?: string };
};

function StatusError() {
  const e = useFieldError("status");
  return e ? <p role="alert" className="border-l-2 border-warm pl-3 text-body-sm sm:col-span-2">{e}</p> : null;
}

export function ProductDetailsForm({ p, library }: { p: ProductRow; library: LibraryImage[] }) {
  const published = p.status === "published";
  return (
    <AdminForm action={saveProduct} submitLabel={published ? "Save changes" : "Save draft"}
      extra={published
        ? <button type="submit" name="intent" value="unpublish" className="h-10 rounded border border-line-strong px-4 text-label hover:border-ink">Unpublish</button>
        : <button type="submit" name="intent" value="publish" className="h-10 rounded border border-blue/50 px-4 text-label text-blue hover:bg-blue/10">Save and publish</button>}>
      <input type="hidden" name="productId" value={p.id} />
      <input type="hidden" name="status" value={p.status === "archived" ? "archived" : p.status} />
      <FormSection title="Details">
        <StatusError />
        <TextInput label="Name" name="name" required defaultValue={p.name} maxLength={160} className="sm:col-span-2" />
        <TextInput label="Slug" name="slug" required defaultValue={p.slug} maxLength={80} hint={`Public URL: /academy/shop/${p.slug}`} />
        <TextAreaInput label="Short description" name="short_description" rows={2} defaultValue={p.short_description ?? ""} maxLength={300} className="sm:col-span-2" hint="Shown on cards and in search results." />
        <TextAreaInput label="Full description" name="description" rows={10} defaultValue={p.description ?? ""} maxLength={20000} className="sm:col-span-2" hint="Plain text. A blank line starts a new paragraph. Describe exactly what's included; no invented reviews or numbers." />
        <ImageField name="cover_image" label="Cover image" current={p.cover_image} library={library} hint="A book cover or product shot. Shown in the shop on a spotlight stage." />
      </FormSection>
      {p.features !== undefined && (
        <FormSection title="Shop page" description="How this product appears in the shop and on its page.">
          <input type="hidden" name="extras_present" value="1" />
          <CheckboxInput label="Feature at the top of the shop" name="featured" defaultChecked={!!p.featured} />
          <TextInput label="Order in the shop" name="display_order" type="number" defaultValue={String(p.display_order ?? 0)} hint="Lower numbers show first (featured products always lead)." />
          <TextInput label="Badge (optional)" name="badge" defaultValue={p.badge ?? ""} maxLength={30} placeholder="New" hint="A short label on the card, e.g. New or Bestseller (only if true)." />
          <TextAreaInput label="What's included (one per line)" name="features" rows={5} defaultValue={(p.features ?? []).join("\n")} className="sm:col-span-2" hint="Shown as a checklist on the product page. Up to 20 lines." />
          <TextInput label="Format" name="detail_format" defaultValue={p.details?.format ?? ""} maxLength={120} placeholder="PDF + EPUB" />
          <TextInput label="Length" name="detail_length" defaultValue={p.details?.length ?? ""} maxLength={120} placeholder="86 pages" />
          <TextInput label="Level" name="detail_level" defaultValue={p.details?.level ?? ""} maxLength={120} placeholder="Beginner" />
          <TextInput label="Note (optional)" name="detail_includes_note" defaultValue={p.details?.includes_note ?? ""} maxLength={120} placeholder="Free updates included" />
          <RepeaterField name="faq" label="Questions and answers" fields={{ title: "Question", body: "Answer" }} initial={(p.faq ?? []).map((x) => ({ title: x.q, body: x.a }))} max={12} className="sm:col-span-2" help="Shown at the bottom of the product page." />
        </FormSection>
      )}
      <FormSection title="Search and sharing">
        <TextInput label="SEO title (optional)" name="seo_title" defaultValue={p.seo_title ?? ""} maxLength={80} className="sm:col-span-2" />
        <TextAreaInput label="SEO description (optional)" name="seo_description" rows={2} defaultValue={p.seo_description ?? ""} maxLength={200} className="sm:col-span-2" />
        <ImageField name="og_image" label="Social share image (optional)" current={p.og_image} library={library} hint="1200 × 630. Falls back to the cover image." />
      </FormSection>
    </AdminForm>
  );
}

export function ProductPricesForm({ productId, prices }: { productId: string; prices: Record<string, number> }) {
  return (
    <AdminForm action={saveProductPrices} submitLabel="Save prices" stickyBar={false}>
      <input type="hidden" name="productId" value={productId} />
      <FormSection title="Prices" description="Leave a currency empty to not sell in it. 0 = free (people still check out, so it lands in their library). Checkout always uses these server-side prices.">
        {(["NGN", "USD", "GBP"] as const).map((c) => (
          <TextInput key={c} label={`${c} price`} name={`price_${c}`} inputMode="decimal" defaultValue={prices[c] != null ? String(prices[c] / 100) : ""} hint={c === "NGN" ? "In naira, e.g. 5000" : c === "USD" ? "In dollars, e.g. 9" : "In pounds, e.g. 7"} />
        ))}
      </FormSection>
    </AdminForm>
  );
}

export function ProductFileForm({ productId, current }: { productId: string; current: { file_name: string; file_size: number | null; updated_at: string } | null }) {
  return (
    <AdminForm action={uploadProductFile} submitLabel={current ? "Replace file" : "Upload file"} stickyBar={false}>
      <input type="hidden" name="productId" value={productId} />
      <FormSection title="Deliverable file" description="Stored privately. Buyers download it from their library through a link that expires after 60 seconds; there is never a public URL.">
        {current && <p className="text-body-sm sm:col-span-2">Current file: <strong className="break-all">{current.file_name}</strong>{current.file_size ? ` · ${(current.file_size / 1_048_576).toFixed(1)} MB` : ""}</p>}
        <FileInput label={current ? "New file" : "File"} name="file" accept=".pdf,.epub,.zip,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.blend,.psd,.csv,.txt" className="sm:col-span-2" hint="Up to 25 MB. PDF, EPUB, ZIP, Office files, images, .blend, .psd, CSV or text." />
      </FormSection>
    </AdminForm>
  );
}

function CheckList({ name, options, selected }: { name: string; options: { id: string; name: string; note?: string }[]; selected: string[] }) {
  if (!options.length) return <p className="text-body-sm text-ink-3 sm:col-span-2">No other products yet.</p>;
  return (
    <ul className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
      {options.map((o) => (
        <li key={o.id}>
          <label className="flex min-h-[44px] items-center gap-3 rounded border border-line px-3 text-body-sm sm:min-h-[40px]">
            <input type="checkbox" name={name} value={o.id} defaultChecked={selected.includes(o.id)} className="h-4 w-4 shrink-0 accent-[rgb(var(--blue))]" />
            <span className="min-w-0 flex-1 truncate">{o.name}</span>{o.note && <span className="shrink-0 text-caption text-ink-3">{o.note}</span>}
          </label>
        </li>
      ))}
    </ul>
  );
}

export function BundleItemsForm({ productId, options, selected }: { productId: string; options: { id: string; name: string; note?: string }[]; selected: string[] }) {
  return (
    <AdminForm action={setBundleItems} submitLabel="Save bundle contents" stickyBar={false}>
      <input type="hidden" name="productId" value={productId} />
      <FormSection title="In this bundle" description="Buying the bundle gives access to every product ticked here (courses included). Bundles can't contain other bundles.">
        <CheckList name="item_ids" options={options} selected={selected} />
      </FormSection>
    </AdminForm>
  );
}

export function RelatedProductsForm({ productId, options, selected }: { productId: string; options: { id: string; name: string; note?: string }[]; selected: string[] }) {
  return (
    <AdminForm action={setRelatedProducts} submitLabel="Save recommendations" stickyBar={false}>
      <input type="hidden" name="productId" value={productId} />
      <FormSection title="Recommended next" description="Shown on this product's page under “Recommended next” (published products only, up to 6). Chosen by you.">
        <CheckList name="related_ids" options={options} selected={selected} />
      </FormSection>
    </AdminForm>
  );
}

export type ShopSettingsRow = {
  title: string; intro: string | null; seo_title: string | null; seo_description: string | null; empty_title: string | null; empty_body: string | null;
  show_newsletter: boolean; newsletter_title: string | null; newsletter_body: string | null;
  /** Present once migration 0010 has run. */
  enabled?: boolean; closed_title?: string | null; closed_body?: string | null;
  /** Present once migration 0013 has run. */
  guest_checkout_enabled?: boolean; downloads_enabled?: boolean; reviews_enabled?: boolean; guest_reviews_enabled?: boolean;
};

export function ShopSettingsForm({ s }: { s: ShopSettingsRow }) {
  return (
    <AdminForm action={saveShopSettings} submitLabel="Save shop settings">
      <FormSection title="Shop page">
        <TextInput label="Title" name="title" required defaultValue={s.title} maxLength={80} />
        <TextAreaInput label="Introduction" name="intro" rows={3} defaultValue={s.intro ?? ""} maxLength={600} className="sm:col-span-2" />
        <TextInput label="When there are no products: heading" name="empty_title" defaultValue={s.empty_title ?? ""} maxLength={120} />
        <TextAreaInput label="When there are no products: text" name="empty_body" rows={2} defaultValue={s.empty_body ?? ""} maxLength={400} className="sm:col-span-2" />
      </FormSection>
      {s.guest_checkout_enabled !== undefined && (
        <FormSection title="Checkout, downloads and reviews" description="Payment security never depends on these: the database checks every order, payment, download and review either way.">
          <input type="hidden" name="commerce_present" value="1" />
          <CheckboxInput label="Guest checkout: people can buy without an account" name="guest_checkout_enabled" defaultChecked={s.guest_checkout_enabled} />
          <CheckboxInput label="Downloads available (switch off only to pause delivery temporarily)" name="downloads_enabled" defaultChecked={s.downloads_enabled !== false} />
          <CheckboxInput label="Product reviews (buyers only, approved by you before they appear)" name="reviews_enabled" defaultChecked={s.reviews_enabled !== false} />
          <CheckboxInput label="Guest buyers can review through their order link" name="guest_reviews_enabled" defaultChecked={s.guest_reviews_enabled !== false} />
        </FormSection>
      )}
      {s.enabled !== undefined && (
        <FormSection title="When the shop is closed" description="Shown on the shop page and on every product page while the shop is closed. Leave empty for the built-in wording.">
          <input type="hidden" name="closed_present" value="1" />
          <TextInput label="Heading" name="closed_title" defaultValue={s.closed_title ?? ""} maxLength={120} placeholder="The shop is closed for now" />
          <TextAreaInput label="Text" name="closed_body" rows={2} defaultValue={s.closed_body ?? ""} maxLength={400} className="sm:col-span-2" placeholder="Ebooks and guides will be back soon. Everything you've already bought is still in your library." />
        </FormSection>
      )}
      <FormSection title="Email sign-up">
        <CheckboxInput label="Show the email sign-up on the shop page" name="show_newsletter" defaultChecked={s.show_newsletter} />
        <TextInput label="Sign-up heading (optional)" name="newsletter_title" defaultValue={s.newsletter_title ?? ""} maxLength={120} />
        <TextAreaInput label="Sign-up text (optional)" name="newsletter_body" rows={2} defaultValue={s.newsletter_body ?? ""} maxLength={300} className="sm:col-span-2" />
      </FormSection>
      <FormSection title="Search and sharing">
        <TextInput label="SEO title (optional)" name="seo_title" defaultValue={s.seo_title ?? ""} maxLength={80} className="sm:col-span-2" />
        <TextAreaInput label="SEO description (optional)" name="seo_description" rows={2} defaultValue={s.seo_description ?? ""} maxLength={200} className="sm:col-span-2" />
      </FormSection>
    </AdminForm>
  );
}
