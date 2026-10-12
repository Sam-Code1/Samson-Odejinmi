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
3. `supabase/seed.sql` (optional: creates the Blender Foundations outline as a **draft**)
4. Authentication → URL configuration: add `http://localhost:3000/auth/callback` to Redirect URLs.
5. Make yourself an admin (after registering):
   ```sql
   insert into public.admin_users (user_id) select id from auth.users where email = 'odejinmisamson37@gmail.com';
   ```

### Environment variables
| Variable | Needed for | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Everything backed by Supabase | Public, protected by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **Resource file downloads only** | Server-only. Never `NEXT_PUBLIC_`. Without it, file downloads are disabled (links still work) |
| `RESEND_API_KEY`, `CONTACT_*` | Contact form delivery | Falls back to a mailto link |
| `PAYSTACK_SECRET_KEY` | Future payments | Server-only. Admin only shows whether it is set |
| `AI_QUESTION_PROVIDER` | Future AI drafts | Nothing is generated until implemented |

If you already ran `seed.sql` before this update, your Blender course is still **published**. Open Admin → Courses → Blender Foundations → Publishing to unpublish it, or leave it published when you're ready.

## 3. Admin (`/admin`)
Authorisation is enforced on the server: signed-out users go to login, signed-in non-admins see an "no access" page, and every action re-checks `is_admin()` in the database. Nothing relies on hiding links.

| Area | What you can do |
|---|---|
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

### Quiz & AI workflow
Students never read answers: the database returns questions without `is_correct` and scores submissions itself. Only questions that are **approved and published** appear. AI output must enter as `ai_generated` drafts; `src/lib/ai/questions.ts` is the plug-in point (no model is called and nothing is faked).

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
- **Paystack checkout and server-side verification**: tables, admin views and settings are ready; the payment flow is not built. Enrol students manually for now.
- **AI generation**: data model + admin review UI only.
- **Drag-and-drop** reordering: replaced by reliable up/down + "move to module" controls.
- **Rich-text editor**: lessons use plain text with paragraphs, `## headings` and `- lists`.
- **Free-preview playback**: the flag is stored; previews are not enabled (every lesson requires enrolment).
- **Video position tracking** (`last_position_seconds`): column exists, not written.
- Unsaved-changes warning covers closing/reloading the tab, not in-app link clicks.
- Rate limiting, e2e tests, monitoring.
# Samson-Odejinmi
