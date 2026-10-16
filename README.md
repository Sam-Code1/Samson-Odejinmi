# Samson Odejinmi + Fola Academy

Next.js 15 (App Router) · TypeScript · Tailwind 3 · Motion · Supabase (Auth, Postgres, RLS, Storage) · Manrope.
Design rules: `DESIGN_LANGUAGE.md`.

## 1. Run it
```bash
npm install
cp .env.example .env.local   # Windows: copy .env.example .env.local
npm run dev                  # http://localhost:3000
npm run lint && npm run typecheck && npm run build
```
The public site works without Supabase. Accounts, learning and Admin need it.

## 2. Supabase setup (in this order, in the SQL editor)
1. `supabase/migrations/0001_init.sql`
2. **`supabase/migrations/0002_admin_cms.sql`** (admin CMS, quizzes, payments, certificates, media, settings, storage buckets, security functions). It is **idempotent**: safe on a fresh database and after a partial earlier run. To see what is/isn't applied first, run `supabase/diagnostics/check_0002_status.sql` (read-only).
3. **`supabase/migrations/0003_website_cms.sql`** (website CMS: site settings, page sections, portfolio, services, SEO, social links, contact messages, activity log; reusable question bank; module publishing; AI generation log). Idempotent, and it seeds the site's existing copy so nothing changes visually. Until it's run, the public site falls back to `src/content/defaults.ts` and the website admin pages ask you to run it.
4. `supabase/migrations/0004_hero_scene.sql` (moves the Spline scene into the homepage hero; safe to re-run).
5. **`supabase/migrations/0005_batch1_foundation.sql`** (admin roles + Owner, admin management, coupons, Paystack checkout/fulfilment, certificate numbering + quiz rule, role-aware RLS). Idempotent and non-destructive. **The earliest existing admin becomes the Owner**; other existing admins become Super Admins.
6. **`supabase/migrations/0006_batch2_ai.sql`** (AI usage log for the student tutor and public chatbot: actor type, hashed visitor key, duration; students read only their own tutor rows; `questions.learning_objective`). Idempotent and non-destructive.
7. **`supabase/migrations/0007_showcase.sql`** (WhatsApp number/message in site settings, homepage intro words + hero backdrop word, the homepage "Playground" game block, and the "Selected *work*" accent heading if it's still the original text). Idempotent and non-destructive.
8. **`supabase/migrations/0008_batch3_products_marketing.sql`** (Batch 3: products, entitlements, unified checkout, private product files, advanced coupons, contacts/CRM, segments, email campaigns, automations, affiliates, attribution, abandoned checkout, WhatsApp log, content campaigns, new admin permissions). Idempotent and non-destructive; course checkout keeps working. Existing accounts become CRM contacts with marketing consent **off**.
9. **`supabase/migrations/0009_batch4_finalization.sql`** (Batch 4: payment provider settings + chosen method on payments, contact inbox with subjects and replies, notifications, security and webhook logs, shop settings and product details). Idempotent and non-destructive; Paystack stays enabled exactly as before.
10. **`supabase/migrations/0010_shop_switch.sql`** (the shop on/off switch in Admin → Products → Shop settings, plus the "closed" message; closing the shop also makes the database refuse new product checkouts, while past purchases, downloads and course checkout keep working). Idempotent; the shop stays open until you close it. Admin → Products → Shop settings shows which of 0008–0010 are still missing on your database.
11. **`supabase/migrations/0011_library_access.sql`** (buyers keep seeing products they own in their Library even after the product is unpublished or archived). Idempotent, read access only.
12. `supabase/seed.sql` (optional: creates the Blender Foundations outline as a **draft**)
13. Authentication → URL configuration: add `http://localhost:3000/auth/callback` to Redirect URLs.
14. Make yourself an admin (after registering):
   ```sql
   insert into public.admin_users (user_id) select id from auth.users where email = 'odejinmisamson37@gmail.com';
   ```

### Environment variables
Full per-environment guide (Development / Preview / Production, Paystack and email setup): **ENVIRONMENT.md**.

| Variable | Needed for | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Everything backed by Supabase | Public, protected by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **Resource file downloads only** | Server-only. Never `NEXT_PUBLIC_`. Without it, file downloads are disabled (links still work) |
| `RESEND_API_KEY`, `CONTACT_*` | Contact form delivery | Falls back to a mailto link |
| `PAYSTACK_SECRET_KEY` | Future payments | Server-only. Admin only shows whether it is set |
| `ANTHROPIC_API_KEY` | AI quiz generator, lesson + content assistants, student tutor, public chatbot (tutor + chatbot also need the service-role key) | **Server-only.** Never `NEXT_PUBLIC_`. Without it the AI pages say so and generate nothing |
| `AI_PROVIDER`, `AI_MODEL` | Optional | `anthropic` (default) and `claude-opus-5-5` (default). Provider code: `src/lib/ai/provider.ts` |

If you already ran `seed.sql` before this update, your Blender course is still **published**. Open Admin → Courses → Blender Foundations → Publishing to unpublish it, or leave it published when you're ready.

## 3. Admin (`/admin`)

### Roles
| Role | Can use |
|---|---|
| Owner (exactly one) | Everything, including Admins (add / invite / change role / disable / remove / transfer ownership) |
| Super Admin | Everything except managing admins |
| Academy Admin | Courses, modules, lessons, quizzes, questions, resources, AI tools, students, enrolments, certificates, media |
| Content Manager | Website CMS, media, coupons |
| Support | Students, enrolments |

Enforced three times: hidden in the sidebar (UI), re-checked in every server action (`runAdmin(permission, …)`), and enforced by RLS through `has_admin_permission()` in the database. Registering, paying or enrolling never grants admin access. Sensitive Owner actions (removing an admin, granting Super Admin, transferring ownership) ask for the Owner's password again, with a 5-attempts-per-15-minutes limit.

Authorisation is enforced on the server: signed-out users go to login, signed-in non-admins see an "no access" page, and every action re-checks `is_admin()` in the database. Nothing relies on hiding links.

| Area | What you can do |
|---|---|
| Website → Homepage / About / Services / Contact | Every block of those pages: text, images (upload or pick from the library), buttons, lists (cards, timeline, steps), draft/published, order on the page, preview |
| Website → Portfolio | Create, edit, publish/unpublish, archive, delete, reorder, "show on homepage", case-study sections, gallery, YouTube video, SEO per project |
| Website → Messages / Social links / SEO | Contact-form inbox (read/archive/delete); social profiles; per-page SEO (title, description, social image, canonical, noindex) |
| AI tools | Quiz generator (lesson → grounded draft questions → review/edit/regenerate/approve → question bank, never auto-published) and content assistant (drafts only) |
| System | Media library (search, alt text, copy link, archive), Site settings, Academy settings, Activity log |
| Dashboard | Real counts, recent enrolments/payments/activity, course performance, quick actions |
| Courses | Create, edit, save draft, publish (with confirmation + checklist), unpublish, archive. Tabs: Overview, Curriculum, Pricing (NGN/USD/GBP), Resources, SEO, Publishing (+ certificates on/off) |
| Curriculum | Add/rename/delete/reorder modules; add/edit/duplicate/delete/publish lessons; reorder with up/down; move between modules |
| Lessons | Title, slug, description, type, YouTube link/ID, duration, text, free-preview flag, **preview as student** |
| Quizzes / Questions | Multiple choice, true/false, multiple select; explanations, points, difficulty; review workflow (approve / reject / publish); attempts list |
| Resources / Media | Private downloadable files and links; public images |
| Students / Enrolments | Search, sort, paginate; student detail (progress, quizzes, payments, certificates); enrol with confirmation; cancel/reactivate |
| Payments | Read-only list (written only by trusted server code) |
| Certificates | List, search, revoke/restore; public verification at `/certificate/[number]` |
| Settings | Academy details, video provider, profile, service status, admin list |

### Video rules (strict view-only)
YouTube is temporary. Students watch inside the lesson page and are never shown a download, share, copy-link or "Watch on YouTube" control, or any URL or video ID. Only the 11-character ID is stored (pasted URLs and embed code are parsed or rejected). The iframe is sandboxed without popups so YouTube's own logo/title links can't open YouTube. There is no video download or proxy route. The video reference is only fetched after sign-in + enrolment + published checks, and RLS blocks anonymous reads of lessons. This reduces casual copying but is **not DRM**: someone who can watch can still screen-record. To move off YouTube later, add a provider to `src/components/learn/VideoPlayer.tsx` (the database already allows `bunny`, `mux`, `cloudflare`).

### Preview
"Preview" buttons in Admin switch on Next.js draft mode after a server-side admin check (`/api/preview`). Public pages then read with your own session, so the database only returns drafts to admins. A banner shows "Exit preview".

### Quiz, question bank & AI workflow
Students never read answers: the database returns questions without `is_correct` and scores submissions itself. Questions live in a reusable bank and are linked to quizzes through `quiz_questions`. Only questions that are **approved, published and not archived** appear, and only in published quizzes.

AI generation (`/admin/ai/quiz-generator`): choose course → module → lesson → sources (lesson text, transcript, notes, PDF/text resources) → count / difficulty / types / explanations → generate. The server builds the material (max 60,000 characters, with explicit notes when anything is shortened), calls the model with structured output, validates every question (shape, 4 distinct options with one correct answer, True/False, no "all of the above", no answer give-aways, explanations), drops exact duplicates and flags near-duplicates, retries once if the output is unusable, and logs the request. You approve/edit/regenerate/reject each card, then save approved questions to the bank (optionally into an existing or new draft quiz). They are saved **approved but unpublished**. Limits: 20 questions per request, 30 AI requests per admin per hour, capped output tokens. Transcripts and teaching notes are stored in the admin-only `lesson_sources` table, never readable by students.

## 4. Testing checklist
1. `/admin` signed out → login. Signed in as a non-admin → "no access". As admin → dashboard.
2. Create a course → add a module → add a lesson with a YouTube link → Preview as student.
3. Publish the lesson, then the course (confirm). It appears at `/academy/courses`. Unpublish → it disappears.
4. Enrol yourself (Admin → Enrolments) → `/learn/<course>/<lesson>` plays the video; Mark complete updates progress.
5. Create a quiz with two questions → Approve + Publish each → publish the quiz → take it as a student.
6. Upload a PDF resource → download it as an enrolled student.
7. Toggle light/dark/system in Admin; open Admin on a phone-width window (drawer nav, table → cards).
8. Turn certificates on, complete every lesson, open `/dashboard` → certificate link → public verification.

## 5. Not built / deferred (honestly)
- **Drag-and-drop** reordering: replaced by reliable up/down + "move to module" controls.
- **Rich-text editor**: lessons use plain text with paragraphs, `## headings` and `- lists`.
- **Free-preview playback**: the flag is stored; previews are not enabled (every lesson requires enrolment).
- **Video position tracking** (`last_position_seconds`): column exists, not written.
- Unsaved-changes warning covers closing/reloading the tab, not in-app link clicks.
- Rate limiting (beyond the AI hourly limit and the contact form's per-email limit), e2e tests, monitoring.
- Testimonials: no section exists because there are no real testimonials to show. Add one only when there are.
- The Academy landing page copy (`/academy`) and the legal pages are still in code; only its SEO is CMS-managed.
- Edits to an already-published section/project/service are live on save (draft/preview applies to unpublished items; there are no draft revisions of published content).
# Samson-Odejinmi
