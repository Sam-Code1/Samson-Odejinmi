# Batch 3: Fola OS (products, sales, marketing, growth)

## Audit: what existed and was reused
| Area | Existing | Batch 3 approach |
|---|---|---|
| Payments | `payments` (one row per checkout), `create_checkout`/`checkout_quote` (course, server-priced), `fulfill_payment` (service role, idempotent), webhook + return page share `fulfilByReference` | Same table and same fulfilment path. `payments.product_id/affiliate_id/attribution` added; `fulfill_payment` extended (entitlements, commissions). Course checkout unchanged. |
| Access | `enrolments` + `is_enrolled()` drive all course RLS | Kept as the course access source. New `entitlements` for every product; course products and courses in bundles also upsert the enrolment. |
| Coupons | `coupons`, `coupon_courses`, `coupon_redemptions` (one per payment) | Extended: `coupon_products`, `campaign_id`, product-aware `coupon_evaluate()`, analytics. |
| People | `profiles` (one per auth user), `admin_users` roles | `contacts`: one marketing identity per email, linked to the account when there is one. Never a second account. |
| Roles | `has_admin_permission()` + `src/lib/admin/roles.ts` | New permissions: `products`, `marketing`, `customers`, `affiliates`. |
| Files | private `course-resources` bucket + 60 s signed URLs | New private `product-files` bucket, same signed-URL pattern, download log + rate limit. |
| Email | Resend, transactional, plain text | Provider abstraction (Resend implemented, batch sending), marketing renderer with unsubscribe + RFC 8058 one-click headers, provider webhook. |
| AI | Batch 2 provider, `AI_FEATURES`, `ai_generations` log | New `marketing` feature in the same layer. Drafts only. |
| Audit | `activity_logs` + `logActivity()` | Used for every sensitive Batch 3 action. |

## What was built
- **Products** (course, ebook, guide, template, digital download, bundle): `products`, `product_prices`, private `product_files`, `bundle_items` (no nesting), `related_products` (manual).
- **Entitlements**: `entitlements` + `grant_product()`; bundles grant every item; course products grant the enrolment.
- **Secure delivery**: `/api/products/[id]/download` → `prepare_product_download()` (ownership, 20/hour, log) → 60-second signed URL. `noindex`, `no-store`.
- **Unified checkout**: `product_checkout_quote()` / `create_product_checkout()`; same Paystack flow, same webhook, same `fulfill_payment()`; free (0 / 100 %) checkouts fulfilled server-side.
- **Coupons**: product restrictions, campaign links, analytics (per coupon + Analytics page).
- **CRM**: contacts, tags, notes, lifecycle (lead / customer / student / repeat customer / inactive, computed from real rows), customer profile.
- **Segments**: 12 fixed presets + tag + lifecycle filters, evaluated live (`segment_contacts()`).
- **Email**: campaigns (draft → scheduled → sending → sent / cancelled), test send, send now, schedule, cancel; metrics only from provider events.
- **Automations**: 7 triggers (sign-up, product, ebook, enrolled, completed, coupon, abandoned checkout); steps send email / add tag / remove tag / wait / forward-only condition; max 20 steps; one run per contact per event; logs.
- **Affiliates**: application, approval, rate, `?ref=` links (30-day cookie), click de-duplication, commission on the amount paid (one per payment), self-referral blocked, refund cancels commission; affiliate dashboard.
- **Attribution**: UTM + referral, first / last touch, cleaned in the browser-free middleware and again in the database.
- **Abandoned checkout**: pending card payments > 2 h → `checkout_abandoned` automation once (sending still needs consent).
- **WhatsApp foundation**: provider abstraction (Meta Cloud API), opt-in + consent enforced, log + signed status webhook.
- **Admin → Sales & marketing**: Overview, Products, Campaigns (+ posts with UTM link builder), Email (+ audiences), Automations, Customers, Affiliates, Coupons, Attribution, Analytics, AI marketing assistant, WhatsApp.
- **Public**: `/academy/shop`, `/academy/shop/[slug]` (SEO + Product JSON-LD), `/library`, `/affiliate`, `/unsubscribe`, newsletter sign-up (explicit opt-in), sign-up opt-in box, email preferences in Settings.
