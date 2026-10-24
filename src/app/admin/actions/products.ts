"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbError, runAdmin } from "@/lib/admin/guard";
import type { ActionResult } from "@/lib/admin/result";
import { isUuid, lines, optStr, slugify, str, SLUG_RE } from "@/lib/admin/validation";
import { logActivity, revalidateSite } from "@/lib/admin/activity";
import { isFile, resolveImageField } from "@/lib/admin/storage";
import { FILE_TYPES, PRODUCT_TYPES, type ProductType } from "@/lib/products";

/**
 * Products ("products" permission). Prices are stored here and read back by the database at checkout; nothing the
 * browser sends at purchase time can change them. Files go to the PRIVATE product-files bucket and are only ever
 * delivered through /api/products/[id]/download after an entitlement check.
 */
const CURRENCIES = ["NGN", "USD", "GBP"] as const;
const MAX_PRODUCT_FILE = 25 * 1024 * 1024;
const FILE_EXT: Record<string, string> = {
  pdf: "application/pdf", epub: "application/epub+zip", zip: "application/zip", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", blend: "application/octet-stream", txt: "text/plain", csv: "text/csv", psd: "application/octet-stream",
};

function refresh(id?: string) {
  revalidateSite();
  revalidatePath("/admin/products");
  revalidatePath("/academy/books", "layout");
  if (id) revalidatePath(`/admin/products/${id}`);
}

export async function createProduct(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("products", async (ctx) => {
    const name = str(fd, "name", 160);
    const type = str(fd, "product_type", 20) as ProductType;
    const courseId = str(fd, "course_id", 40);
    const errors: Record<string, string> = {};
    if (!name) errors.name = "Name is required.";
    if (!(PRODUCT_TYPES as readonly string[]).includes(type)) errors.product_type = "Choose a product type.";
    if (type === "course" && !isUuid(courseId)) errors.course_id = "Choose the course this product sells.";
    const slug = slugify(str(fd, "slug", 80) || name);
    if (!SLUG_RE.test(slug)) errors.slug = "Use lowercase letters, numbers and dashes.";
    if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
    const { data, error } = await ctx.supabase.from("products").insert({
      name, slug, product_type: type, course_id: type === "course" ? courseId : null, status: "draft", created_by: ctx.user.id,
    }).select("id").single();
    if (error?.code === "23505") return { ok: false, fieldErrors: error.message.includes("course") ? { course_id: "That course already has a product." } : { slug: "Another product already uses that slug." } };
    if (error || !data) return dbError(error);
    await logActivity(ctx, "product created", "product", data.id as string, name, { type });
    refresh();
    redirect(`/admin/products/${data.id}`);
  });
}

export async function saveProduct(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("products", async (ctx) => {
    const id = str(fd, "productId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing product." };
    const { data: before } = await ctx.supabase.from("products").select("name, status, product_type, published_at").eq("id", id).maybeSingle();
    if (!before) return { ok: false, error: "That product no longer exists." };
    const errors: Record<string, string> = {};
    const name = str(fd, "name", 160);
    if (!name) errors.name = "Name is required.";
    const slug = str(fd, "slug", 80);
    if (!SLUG_RE.test(slug)) errors.slug = "Use lowercase letters, numbers and dashes.";
    const intent = str(fd, "intent", 12);
    let status = str(fd, "status", 12) || (before.status as string);
    if (intent === "publish") status = "published";
    if (intent === "unpublish") status = "draft";
    if (intent === "coming_soon") status = "coming_soon";
    if (!["draft", "coming_soon", "published", "archived"].includes(status)) errors.status = "Choose a status.";

    const patch: Record<string, unknown> = {
      name, slug, status, short_description: optStr(fd, "short_description", 300), description: optStr(fd, "description", 20000),
      seo_title: optStr(fd, "seo_title", 80), seo_description: optStr(fd, "seo_description", 200),
    };
    for (const [field, kind] of [["cover_image", "site_image"], ["og_image", "og_image"]] as const) {
      const r = await resolveImageField(ctx, fd, field, kind);
      if (!r.ok) errors[field] = r.error; else if (r.url !== undefined) patch[field] = r.url;
    }
    // Edition and launch note (migration 0018). Only sent when the database has them.
    if (fd.has("edition_present")) {
      patch.edition = optStr(fd, "edition", 40);
      patch.launch_note = optStr(fd, "launch_note", 80);
    }
    // Shop details (migration 0009). Only read when the form sends them, so older databases keep saving.
    if (fd.has("extras_present")) {
      const order = Number(str(fd, "display_order", 6) || "0");
      if (!Number.isInteger(order) || order < -9999 || order > 9999) errors.display_order = "Use a whole number (lower shows first).";
      patch.display_order = Number.isInteger(order) ? order : 0;
      patch.featured = fd.get("featured") === "on";
      patch.badge = optStr(fd, "badge", 30);
      patch.features = lines(fd, "features", 20, 160);
      let faq: { q: string; a: string }[] = [];
      try {
        const raw = JSON.parse(str(fd, "faq", 20000) || "[]");
        faq = (Array.isArray(raw) ? raw : []).map((x: { title?: unknown; body?: unknown }) => ({ q: String(x?.title ?? "").trim().slice(0, 160), a: String(x?.body ?? "").trim().slice(0, 600) })).filter((x) => x.q && x.a).slice(0, 12);
      } catch { errors.faq = "The questions couldn't be read. Reload and try again."; }
      patch.faq = faq;
      const details: Record<string, string> = {};
      for (const k of ["format", "length", "level", "includes_note"] as const) { const v = optStr(fd, `detail_${k}`, 120); if (v) details[k] = v; }
      patch.details = details;
    }
    if (status === "published") {
      // Only sellable products can be published: a price, and a file for file products, or items for bundles.
      const [{ count: prices }, { data: file }, { count: items }] = await Promise.all([
        ctx.supabase.from("product_prices").select("id", { count: "exact", head: true }).eq("product_id", id).eq("active", true),
        ctx.supabase.from("product_files").select("product_id").eq("product_id", id).maybeSingle(),
        ctx.supabase.from("bundle_items").select("product_id", { count: "exact", head: true }).eq("bundle_id", id),
      ]);
      const t = before.product_type as ProductType;
      if (t !== "course" && !prices) errors.status = "Add a price before publishing.";
      else if (FILE_TYPES.includes(t) && !file) errors.status = "Upload the file before publishing.";
      else if (t === "bundle" && !items) errors.status = "Add at least one product to the bundle before publishing.";
      if (!before.published_at) patch.published_at = new Date().toISOString();
    }
    if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
    const { error } = await ctx.supabase.from("products").update(patch).eq("id", id);
    if (error?.code === "23505") return { ok: false, fieldErrors: { slug: "Another product already uses that slug." } };
    if (error?.code === "23514" && status === "coming_soon") return { ok: false, fieldErrors: { status: "Run migration 0018 in Supabase to use “Coming soon”." } };
    if (error) return dbError(error);
    const action = before.status !== status ? (status === "published" ? "product published" : status === "coming_soon" ? "product set to coming soon" : status === "archived" ? "product archived" : "product unpublished") : "product updated";
    await logActivity(ctx, action, "product", id, name);
    refresh(id);
    return { ok: true, message: before.status === status ? "Product saved."
      : status === "published" ? "Published. It's live in the shop and on sale."
      : status === "coming_soon" ? "Now Coming soon: visible in Books with its details and price, but not on sale until you publish."
      : "Product saved." };
  });
}

/** Price list: one row per currency. Empty amount = not sold in that currency. Changes are audit-logged. */
export async function saveProductPrices(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("products", async (ctx) => {
    const id = str(fd, "productId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing product." };
    const { data: p } = await ctx.supabase.from("products").select("name, product_type").eq("id", id).maybeSingle();
    if (!p) return { ok: false, error: "That product no longer exists." };
    if (p.product_type === "course") return { ok: false, error: "Course prices are set on the course (Courses → Pricing), so there's one price list per course." };
    const errors: Record<string, string> = {};
    const rows: { currency: string; amount_minor: number }[] = [];
    for (const c of CURRENCIES) {
      const raw = str(fd, `price_${c}`, 20).replace(/,/g, "");
      if (!raw) continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0 || n > 10_000_000) { errors[`price_${c}`] = "Enter an amount, e.g. 5000 (or 0 for free)."; continue; }
      rows.push({ currency: c, amount_minor: Math.round(n * 100) });
    }
    if (Object.keys(errors).length) return { ok: false, fieldErrors: errors };
    const { data: old } = await ctx.supabase.from("product_prices").select("currency, amount_minor").eq("product_id", id);
    const keep = rows.map((r) => r.currency);
    const del = ((old ?? []) as { currency: string }[]).map((o) => o.currency).filter((c) => !keep.includes(c));
    if (del.length) { const { error } = await ctx.supabase.from("product_prices").delete().eq("product_id", id).in("currency", del); if (error) return dbError(error); }
    if (rows.length) {
      const { error } = await ctx.supabase.from("product_prices").upsert(rows.map((r) => ({ product_id: id, ...r, active: true })), { onConflict: "product_id,currency" });
      if (error) return dbError(error);
    }
    const summary = rows.map((r) => `${r.currency} ${r.amount_minor / 100}`).join(", ") || "none";
    await logActivity(ctx, "price changed", "product", id, p.name as string, { prices: summary.slice(0, 120) });
    refresh(id);
    return { ok: true, message: "Prices saved." };
  });
}

/**
 * Large files (anything over Vercel's 4.5 MB request limit) are uploaded by the admin's browser straight to the private
 * product-files bucket (Storage policy: products permission only). This then checks the stored object and attaches it:
 * the path must sit in this product's folder, the type must be allowed, and the real stored size must be within limits.
 */
export async function attachProductFile(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("products", async (ctx) => {
    const id = str(fd, "productId", 40);
    const path = str(fd, "path", 300);
    const fileName = str(fd, "file_name", 200);
    if (!isUuid(id)) return { ok: false, error: "Missing product." };
    const folder = `products/${id}/`;
    if (!path.startsWith(folder) || path.includes("..") || path.slice(folder.length).includes("/")) return { ok: false, error: "That upload doesn't belong to this product." };
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    const mime = FILE_EXT[ext];
    const discard = async () => { await ctx.supabase.storage.from("product-files").remove([path]); };
    if (!mime) { await discard(); return { ok: false, fieldErrors: { file: "Use PDF, EPUB, ZIP, Word, Excel, PowerPoint, PNG/JPG, .blend, .psd, CSV or text." } }; }
    const { data: p } = await ctx.supabase.from("products").select("name, product_type").eq("id", id).maybeSingle();
    if (!p || !FILE_TYPES.includes(p.product_type as ProductType)) { await discard(); return { ok: false, error: "Only ebooks, guides, templates and downloads have a file." }; }
    // The size comes from Storage itself, not from the browser.
    const { data: listed } = await ctx.supabase.storage.from("product-files").list(folder.slice(0, -1), { search: path.slice(folder.length), limit: 1 });
    const obj = listed?.find((o) => `${folder}${o.name}` === path);
    if (!obj) return { ok: false, error: "The upload wasn't found. Try uploading again." };
    const size = Number((obj.metadata as { size?: number } | null)?.size ?? 0);
    if (size > MAX_PRODUCT_FILE) { await discard(); return { ok: false, fieldErrors: { file: "Files must be 25 MB or smaller. For bigger files, upload a ZIP of the essentials." } }; }
    const { data: old } = await ctx.supabase.from("product_files").select("file_path").eq("product_id", id).maybeSingle();
    const { error } = await ctx.supabase.from("product_files").upsert({ product_id: id, file_path: path, file_name: (fileName || path.slice(folder.length)).slice(0, 200), file_size: size || null, mime_type: mime, uploaded_by: ctx.user.id }, { onConflict: "product_id" });
    if (error) { await discard(); return dbError(error); }
    if (old?.file_path && old.file_path !== path) await ctx.supabase.storage.from("product-files").remove([old.file_path as string]);
    await logActivity(ctx, "product file uploaded", "product", id, p.name as string, { size });
    refresh(id);
    return { ok: true, message: "File uploaded. Buyers download it from their library through a private, expiring link." };
  });
}

export async function setBundleItems(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("products", async (ctx) => {
    const id = str(fd, "productId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing product." };
    const ids = [...new Set(fd.getAll("item_ids").map(String).filter(isUuid))].filter((x) => x !== id).slice(0, 30);
    const { data: p } = await ctx.supabase.from("products").select("name, product_type").eq("id", id).maybeSingle();
    if (p?.product_type !== "bundle") return { ok: false, error: "Only bundles hold other products." };
    await ctx.supabase.from("bundle_items").delete().eq("bundle_id", id);
    if (ids.length) {
      const { error } = await ctx.supabase.from("bundle_items").insert(ids.map((pid, i) => ({ bundle_id: id, product_id: pid, position: i + 1 })));
      if (error) return dbError(error, "Bundles can't contain other bundles. Remove any bundle and try again.");
    }
    await logActivity(ctx, "bundle contents changed", "product", id, p.name as string, { items: ids.length });
    refresh(id);
    return { ok: true, message: "Bundle contents saved." };
  });
}

/** "You may also like": chosen by hand, never generated. */
export async function setRelatedProducts(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("products", async (ctx) => {
    const id = str(fd, "productId", 40);
    if (!isUuid(id)) return { ok: false, error: "Missing product." };
    const ids = [...new Set(fd.getAll("related_ids").map(String).filter(isUuid))].filter((x) => x !== id).slice(0, 6);
    await ctx.supabase.from("related_products").delete().eq("product_id", id);
    if (ids.length) {
      const { error } = await ctx.supabase.from("related_products").insert(ids.map((rid, i) => ({ product_id: id, related_id: rid, position: i + 1 })));
      if (error) return dbError(error);
    }
    refresh(id);
    return { ok: true, message: "Recommendations saved." };
  });
}

/** Shop page copy and layout (migration 0009, "products" permission). */
/** Opens or closes the shop (migration 0010). Closing is also enforced by the database: no new product checkouts. */
export async function setShopOpen(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("products", async (ctx) => {
    const open = fd.get("open") === "1";
    const { data, error } = await ctx.supabase.from("shop_settings").update({ enabled: open }).eq("id", true).select("id");
    if (error) return dbError(error, "Couldn't change the shop. Run migration 0010_shop_switch.sql first.");
    if (!data?.length) return { ok: false, message: "Shop settings are missing. Run migrations 0009 and 0010, then try again." };
    await logActivity(ctx, open ? "shop opened" : "shop closed", "shop_settings", null, "Shop");
    refresh();
    return { ok: true, message: open ? "The shop is open." : "The shop is closed. Existing purchases still work." };
  });
}

export async function saveShopSettings(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return runAdmin("products", async (ctx) => {
    const title = str(fd, "title", 80);
    if (!title) return { ok: false, fieldErrors: { title: "The shop needs a title." } };
    const { error } = await ctx.supabase.from("shop_settings").update({
      title, intro: optStr(fd, "intro", 600), seo_title: optStr(fd, "seo_title", 80), seo_description: optStr(fd, "seo_description", 200),
      empty_title: optStr(fd, "empty_title", 120), empty_body: optStr(fd, "empty_body", 400), show_newsletter: fd.get("show_newsletter") === "on",
      newsletter_title: optStr(fd, "newsletter_title", 120), newsletter_body: optStr(fd, "newsletter_body", 300),
      // The "closed" message fields exist from migration 0010; the form only sends them then.
      ...(fd.get("closed_present") === "1" ? { closed_title: optStr(fd, "closed_title", 120), closed_body: optStr(fd, "closed_body", 400) } : {}),
      // Commerce switches (migration 0013).
      ...(fd.get("commerce_present") === "1" ? {
        guest_checkout_enabled: fd.get("guest_checkout_enabled") === "on", downloads_enabled: fd.get("downloads_enabled") === "on",
        reviews_enabled: fd.get("reviews_enabled") === "on", guest_reviews_enabled: fd.get("guest_reviews_enabled") === "on",
      } : {}),
    }).eq("id", true);
    if (error) return dbError(error, "Couldn't save. Run migration 0009.");
    await logActivity(ctx, "shop settings updated", "shop_settings", null, "Shop");
    refresh();
    return { ok: true, message: "Shop settings saved." };
  });
}
