# CMS audit & placeholder report

Audit of the codebase before and after the Website CMS work (migration `0003_website_cms.sql`).

## Before → after

| Content | Before | Now (source of truth) | Edit in |
|---|---|---|---|
| Homepage copy (hero, statement, about preview, disciplines, Academy intro, workflow intro, exploring, contact CTA) | Hard-coded in `src/app/(site)/page.tsx` and `src/content/services.ts` | `page_sections` (page `home`) | Admin → Website → Homepage |
| Homepage hero 3D scene (new) | — | `page_sections` `home/hero` (Spline scene URL in settings) | Admin → Website → Homepage → Hero |
| About page (intro, biography, philosophy, timeline, NARRIO, direction, CTA) | Hard-coded in `about/page.tsx` + `src/content/about.ts` | `page_sections` (page `about`) | Admin → Website → About |
| Portfolio projects | `src/content/projects.ts` | `portfolio_projects`, `portfolio_media` | Admin → Website → Portfolio |
| Services + process steps | `src/content/services.ts` | `services`, `page_sections` `services/process` | Admin → Website → Services |
| Contact copy, email, availability | Hard-coded + env var | `page_sections` `contact/intro`, `site_settings` | Admin → Website → Contact |
| Contact form submissions | Email only (or mailto fallback) | `contact_messages` (insert-only for the public) + email if Resend is set | Admin → Website → Messages |
| Social links | `site.socials = []` in `src/lib/site.ts` | `social_links` | Admin → Website → Social links |
| Site name, footer, defaults, logo, favicon, OG image | `src/lib/site.ts`, `layout.tsx` | `site_settings` | Admin → System → Site settings |
| Page SEO | `export const metadata` per page | `seo_metadata` (+ per-project and per-course fields) | Admin → Website → SEO |
| Lesson transcript / notes (AI source) | — | `lesson_sources` (admin-only) | Lesson editor |
| Quiz questions | Owned by one quiz | Reusable bank, linked by `quiz_questions` | Admin → Question bank / Quizzes |

`src/content/defaults.ts` mirrors the seed and is used **only** when Supabase isn't configured or 0003 hasn't been run. Editing it does not change a connected site.

## Placeholders found

| File | Placeholder | Represents | CMS source | Status |
|---|---|---|---|---|
| `src/content/projects.ts` (removed) | 4 entries: "Product scene", "Environment study", "Animation test", "VFX exploration", `placeholder: true` | Real portfolio projects | `portfolio_projects` (`is_placeholder = true`) | **Connected.** Seeded as published, clearly labelled placeholders so the site looks unchanged. The Portfolio admin shows a banner asking you to replace or archive them. They're excluded from the sitemap and set to noindex. |
| `src/components/visual/MediaFrame.tsx` `PlaceholderArt` | SVG stand-in art | Project cover images | `portfolio_projects.cover_image_url` | **Connected.** Shown only when a project has no cover image. |
| `src/components/ui/hero-preview-walls.tsx` | `PlaceholderArt` inside capability cards | Decorative art | n/a (design) | Kept: decorative, not content. Card text is CMS-driven. |
| `src/components/ui/carousel-07.tsx` | `PlaceholderArt` | Slide images | Project cover image | **Connected** via the project's cover. |
| `src/app/(site)/legal/[slug]/page.tsx` | Placeholder legal pages | Privacy, terms, refund policy | — | **Not connected.** Needs real, reviewed policies (owner/legal input). Pages are noindex. |
| `src/app/(academy)/academy/page.tsx` | "Coming soon" badges on Guides / Blueprints / Workbooks / Cheat sheets | Academy resources not yet published | — | **Not connected.** Academy landing copy is still in code (SEO is CMS-driven). |
| `src/components/learn/VideoPlayer.tsx` | "Video coming soon" | Empty-state for lessons without a video | n/a | Kept: a genuine empty state. |
| `src/lib/academy.ts` `sample()` | Built-in Blender Foundations outline | Course catalogue when Supabase isn't configured | `courses` etc. | Kept as an offline fallback only. |

No lorem ipsum, fake testimonials, fake clients, invented statistics, awards or employment history were found, and none were added.
