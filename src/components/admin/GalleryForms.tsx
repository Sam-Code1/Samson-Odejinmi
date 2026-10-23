"use client";

import { deleteGalleryItem, updateGalleryItem, uploadGalleryItems } from "@/app/admin/actions/gallery";
import { GALLERY_CATEGORIES } from "@/lib/gallery-categories";
import { AdminForm } from "./AdminForm";
import { ActionButton } from "./ActionButton";
import { CheckboxInput, FileInput, SelectInput, TextAreaInput, TextInput } from "./FormFields";

const CATEGORY_OPTIONS = GALLERY_CATEGORIES.map((c) => ({ value: c.id, label: c.label }));

export function GalleryUploadForm() {
  return (
    <AdminForm action={uploadGalleryItems} submitLabel="Add to gallery" stickyBar={false}>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <FileInput label="Images or videos" name="files" multiple accept="image/png,image/jpeg,image/webp,image/gif,image/avif,video/mp4,video/webm"
          hint="Several at once. Images up to 5 MB, videos up to 25 MB; 25 MB per upload in total." className="sm:col-span-2" />
        <SelectInput label="Category" name="category" defaultValue="" options={[{ value: "", label: "Detect from file names" }, ...CATEGORY_OPTIONS]}
          hint="Detection reads words like “render”, “product”, “website”. Change any piece afterwards." />
        <TextInput label="Series (optional)" name="series" maxLength={80} hint="Groups pieces, e.g. a brand name." />
      </div>
      <CheckboxInput label="Feature on the homepage" name="featured" hint="Featured pieces lead the Selected work section." />
    </AdminForm>
  );
}

export type GalleryRow = {
  id: string; title: string; category: string; series: string | null; description: string | null; link_url: string | null;
  kind: string; src: string; poster: string | null; status: string; featured: boolean; position: number;
};

export function GalleryItemForm({ item }: { item: GalleryRow }) {
  return (
    <div className="space-y-3">
      <AdminForm action={updateGalleryItem} submitLabel="Save" stickyBar={false}>
        <input type="hidden" name="id" value={item.id} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="Title" name="title" defaultValue={item.title} maxLength={160} required />
          <SelectInput label="Category" name="category" defaultValue={item.category} options={CATEGORY_OPTIONS} />
          <TextInput label="Series" name="series" defaultValue={item.series ?? ""} maxLength={80} />
          <SelectInput label="Status" name="status" defaultValue={item.status} options={[{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }, { value: "hidden", label: "Hidden" }]} />
          <TextInput label="Live link (optional)" name="link_url" type="url" defaultValue={item.link_url ?? ""} maxLength={300} placeholder="https://" hint="For websites and apps: shown as “Visit the live site”." />
          <TextInput label="Order" name="position" type="number" defaultValue={String(item.position)} hint="Lower comes first." />
        </div>
        <TextAreaInput label="Description (optional)" name="description" defaultValue={item.description ?? ""} maxLength={600} rows={3} />
        <CheckboxInput label="Feature on the homepage" name="featured" defaultChecked={item.featured} />
      </AdminForm>
      {/* Its own form: forms can't nest. */}
      <ActionButton action={deleteGalleryItem} fields={{ id: item.id }} variant="danger" confirm={{ title: `Remove “${item.title}”?`, body: "It disappears from the website. The file stays in storage.", label: "Remove" }}>Remove from gallery</ActionButton>
    </div>
  );
}
