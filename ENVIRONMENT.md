# Environment variables

Only `NEXT_PUBLIC_*` values are sent to the browser, so they must be safe to publish. Every secret below is read only by
server code (server actions, route handlers, server components). Never prefix a secret with `NEXT_PUBLIC_`, never commit
`.env.local` (it's in `.gitignore`), and set production values in **Vercel → Project → Settings → Environment Variables**.

| Variable | Secret? | Development | Preview | Production | What it's for |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | No | `http://localhost:3000` | the preview URL (optional) | **required**, e.g. `https://yourdomain.com` | Canonical URLs, auth redirects, Paystack return URL, certificate links |
| `NEXT_PUBLIC_SUPABASE_URL` | No | required | required | **required** | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No (RLS-protected) | required | required | **required** | Browser/server Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | **Yes** | for payment testing | for payment testing | **required** | Confirming payments (`fulfill_payment` is service-role only), private file downloads, admin invitations |
| `PAYSTACK_SECRET_KEY` | **Yes** | `sk_test_…` | `sk_test_…` | `sk_test_…` until tested, then `sk_live_…` | Initialize/verify transactions; webhook signature check |
| `PAYSTACK_CURRENCIES` | No | `NGN` | `NGN` | currencies enabled on your Paystack account | Which course prices can be paid online |
| `RESEND_API_KEY` | **Yes** | optional | optional | recommended | Transactional email + contact form |
| `EMAIL_FROM` | No | optional | optional | your verified sender | From address for transactional email |
| `NEXT_PUBLIC_CONTACT_EMAIL`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` | No | optional | optional | optional | Contact form (the CMS contact email takes precedence on the site) |
| `ANTHROPIC_API_KEY` | **Yes** | optional | optional | optional | AI tools in Admin, student AI tutor, public Academy chatbot. **Never** `NEXT_PUBLIC_ANTHROPIC_API_KEY` |
| `AI_PROVIDER`, `AI_MODEL` | No | optional | optional | optional | AI provider/model selection (default `claude-opus-5-5`) |
| `AI_MODEL_<FEATURE>` | No | optional | optional | optional | Per-feature model override: `QUIZ`, `REGENERATE`, `CONTENT`, `LESSON_ASSISTANT`, `TUTOR`, `CHATBOT` |
| `AI_PUBLIC_DAILY_CAP` | No | optional | optional | recommended | Daily ceiling on public chatbot requests across all visitors (default 500) |
| `AI_RATE_SALT` | **Yes** | optional | optional | recommended | Salt for hashing visitor IPs in the AI log (falls back to the service-role key) |

The student tutor and the public chatbot appear only when **both** `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY`
are set, because their per-user/per-visitor limits are counted server-side. `/academy` is statically cached, so redeploy
after changing these.

`NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` is **not used**: checkout redirects to Paystack's hosted page (initialized server-side),
so no Paystack key is ever needed in the browser. Add it only if an inline popup checkout is built later.

Vercel: give Preview the **test** Paystack key and Production the key for the mode you're in. A preview deployment should
point at a separate Supabase project (or the same one only if you accept that test payments create real enrolment rows).

## Paystack setup
1. Paystack Dashboard → Settings → API Keys & Webhooks.
2. Copy the **secret** key into `PAYSTACK_SECRET_KEY` (test key first).
3. Set **Webhook URL** to `https://<your-domain>/api/webhooks/paystack` (test and live each have their own field).
4. Callback URL can be left empty: each transaction sends its own (`/academy/checkout/callback`).
5. Make sure `SUPABASE_SERVICE_ROLE_KEY` is set, otherwise payments are received but can't be confirmed (the webhook returns 500 so Paystack retries, and the student sees "confirming").
6. Test with Paystack's test cards, check the payment shows **successful** in Admin → Payments and the student can open the course.
7. Only then switch to `sk_live_…`.

## Email setup
- App emails (purchase, enrolment, certificate, welcome after confirmation) use Resend: set `RESEND_API_KEY` and a verified `EMAIL_FROM`.
- Account emails (confirm email, reset password, admin invitations) are sent by **Supabase Auth**. In Supabase → Authentication → SMTP Settings, use the same provider so they come from your domain. In Supabase → Authentication → URL Configuration add `https://<your-domain>/auth/callback` to Redirect URLs.
- Without a provider, nothing is reported as sent.
