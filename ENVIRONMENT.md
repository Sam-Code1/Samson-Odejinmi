# Environment variables

Only `NEXT_PUBLIC_*` values are sent to the browser, so they must be safe to publish. Every secret below is read only by
server code (server actions, route handlers, server components). Never prefix a secret with `NEXT_PUBLIC_`, never commit
`.env.local` (it's in `.gitignore`), and set production values in **Vercel → Project → Settings → Environment Variables**.

| Variable | Secret? | Development | Preview | Production | What it's for |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | No | `http://localhost:3000` | the preview URL (optional) | recommended, e.g. `https://yourdomain.com` (never `localhost`: on Vercel a localhost value is ignored and the project's production domain, `VERCEL_PROJECT_PRODUCTION_URL`, is used instead) | Canonical URLs, auth redirects, Paystack return URL, certificate verification links and QR codes |
| `MICROLINK_API_KEY` | No | not needed | not needed | optional | Website projects: screenshots and details when you paste a link (Admin → Website → Projects). Without a key Microlink allows a small free daily number of captures. |
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
| `EMAIL_PROVIDER` | No | optional | optional | optional | `resend` (default) or `none` |
| `MARKETING_EMAIL_FROM` | No | optional | optional | recommended | Verified sender for campaigns/automations (defaults to `EMAIL_FROM`) |
| `MARKETING_POSTAL_ADDRESS` | No | optional | optional | recommended | Address in marketing email footers |
| `RESEND_WEBHOOK_SECRET` | **Yes** | optional | optional | recommended | Verifies `/api/webhooks/email` (delivery, opens, clicks, bounces, complaints) |
| `CRON_SECRET` | **Yes** | optional | for testing | **required for scheduled sends/automations** | Protects `/api/cron/marketing` |
| `AFFILIATE_CLICK_SALT` | **Yes** | optional | optional | optional | Salt for de-duplicating referral clicks |
| `WHATSAPP_PROVIDER`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | token/secret: **Yes** | optional | optional | optional | WhatsApp Cloud API foundation (off unless all set) |

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


## Batch 3: products, email marketing, affiliates
- **Products and downloads** need `SUPABASE_SERVICE_ROLE_KEY` (signed download links) and migration 0008 (creates the private `product-files` bucket).
- **Email campaigns and automations** need `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and a verified sender. Marketing email only ever goes to contacts who opted in; every message has a one-click unsubscribe.
- **Delivery, opens, clicks, bounces**: in Resend → Webhooks add `https://<your-domain>/api/webhooks/email` with the events email.delivered, email.opened, email.clicked, email.bounced, email.complained; put the signing secret in `RESEND_WEBHOOK_SECRET`. Without it, only "sent" is known (nothing is guessed).
- **Scheduled campaigns, automations, abandoned-checkout follow-ups** run from `/api/cron/marketing`. `vercel.json` schedules it once a day (the most the Vercel Hobby plan allows). On Pro you can change the schedule to e.g. `*/15 * * * *`, or call the URL from any scheduler with `Authorization: Bearer <CRON_SECRET>`. "Send now" and Admin → Marketing → "Run marketing queue now" work without cron.
- **Affiliate links**: `?ref=<code>` on any page. The middleware stores the code in a first-party cookie for 30 days; commissions are calculated by the database when the payment is verified.


## Batch 4: payment providers, messaging, security
| Variable | Secret? | Purpose |
|---|---|---|
| `FLUTTERWAVE_SECRET_KEY` | **Yes** | Flutterwave (secondary provider). Test keys start `FLWSECK_TEST-`. Off unless set **and** enabled in Admin → Settings → Payment settings |
| `FLUTTERWAVE_WEBHOOK_HASH` | **Yes** | The "secret hash" you set in Flutterwave → Settings → Webhooks; verified on `/api/webhooks/flutterwave` |
| `SECURITY_LOG_SALT` | **Yes** | Optional salt for hashing emails/IPs in the security log |
| `CONTACT_TO_EMAIL` | No | Where website messages are emailed (falls back to the site's contact email). Also the Reply-To and BCC on dashboard replies |
| `CONTACT_FROM_EMAIL` | No | Verified sender for message notifications and replies (falls back to `EMAIL_FROM`) |

- **Paystack** (primary) needs only `PAYSTACK_SECRET_KEY` and the webhook `https://<domain>/api/webhooks/paystack`. Methods offered (card, bank, bank transfer, USSD, QR) are chosen in Admin → Settings → Payment settings; tick only what's activated on your Paystack account.
- **Flutterwave**: add the key and secret hash, set the webhook `https://<domain>/api/webhooks/flutterwave`, then enable it in Payment settings with its currencies and methods. **OPay** and **NQR** are offered through Flutterwave and must be activated on your Flutterwave account first.
- **PalmPay**: listed as a future provider only. It stays disabled until an official, documented merchant checkout API is confirmed for this business.
- Checkout shows a method only if an enabled, configured provider can process it in that currency; local Nigerian methods appear only for buyers in Nigeria (Vercel's `x-vercel-ip-country`).
- **Website messages**: saved in the database, emailed to `CONTACT_TO_EMAIL` with Reply-To set to the visitor. Replies from Admin → Messages go To the visitor, Reply-To and BCC your inbox. The BCC copy lands in your inbox, not your mail app's Sent folder.
