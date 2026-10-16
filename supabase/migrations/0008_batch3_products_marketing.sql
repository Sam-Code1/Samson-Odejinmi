-- 0008: Batch 3 (Fola OS). Digital products, entitlements, unified checkout, advanced coupons, contacts/CRM, segments,
-- email campaigns, automations, affiliates, attribution, abandoned checkout, WhatsApp foundation, content campaigns.
--
-- Run AFTER 0001–0007. IDEMPOTENT and NON-DESTRUCTIVE: nothing is dropped or reset. Existing functions are replaced only
-- with supersets of their previous behaviour (course checkout, fulfilment and refunds keep working exactly as before).
-- No sample data: every table starts empty except contacts, which are created from existing accounts with marketing
-- consent OFF (nobody receives marketing until they opt in).

-- ═════════════════════════ PERMISSIONS ═════════════════════════
-- New areas: products, marketing (campaigns, email, automations, content, analytics), customers (CRM / personal data),
-- affiliates (commissions and payout details). Mirrored for the UI in src/lib/admin/roles.ts.
create or replace function public.has_admin_permission(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case a.role
      when 'owner' then true
      when 'super_admin' then p <> 'admins'
      when 'academy_admin' then p in ('academy','media','ai','students','enrolments','certificates','products')
      when 'content_manager' then p in ('website','media','coupons','marketing','products')
      when 'support' then p in ('students','enrolments','customers')
      else false end
    from public.admin_users a where a.user_id = auth.uid() and a.status = 'active'), false);
$$;

-- ═════════════════════════ MARKETING CAMPAIGNS (umbrella) ═════════════════════════
-- One row per initiative (e.g. a launch). Its slug is the utm_campaign value; coupons, emails and posts can belong to it.
create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  description text check (description is null or char_length(description) <= 2000),
  starts_on date,
  ends_on date,
  status text not null default 'draft' check (status in ('draft','active','completed','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_campaigns_dates check (starts_on is null or ends_on is null or starts_on <= ends_on)
);
create unique index if not exists marketing_campaigns_slug_key on public.marketing_campaigns (slug);

-- ═════════════════════════ PRODUCTS ═════════════════════════
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  name text not null check (char_length(name) between 1 and 160),
  short_description text check (short_description is null or char_length(short_description) <= 300),
  description text check (description is null or char_length(description) <= 20000),
  product_type text not null check (product_type in ('course','ebook','guide','template','download','bundle')),
  course_id uuid references public.courses(id) on delete restrict,
  cover_image text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  seo_title text check (seo_title is null or char_length(seo_title) <= 80),
  seo_description text check (seo_description is null or char_length(seo_description) <= 200),
  og_image text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A course product points at the existing course (never a copy of it); other products never do.
  constraint products_course_link check ((product_type = 'course') = (course_id is not null))
);
create unique index if not exists products_slug_key on public.products (slug);
create unique index if not exists products_course_key on public.products (course_id) where course_id is not null;
create index if not exists products_status_idx on public.products (status, product_type);

-- Prices for non-course products (course products use course_pricing, so a course has one price list).
create table if not exists public.product_prices (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor integer not null check (amount_minor >= 0 and amount_minor <= 1000000000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, currency)
);

-- The deliverable file of an ebook/guide/template/download. PRIVATE: path in the private product-files bucket.
-- Separate table so the public product rows never carry it; only admins and the signed-download path read it.
create table if not exists public.product_files (
  product_id uuid primary key references public.products(id) on delete cascade,
  file_path text not null check (file_path ~ '^[A-Za-z0-9/_.-]+$' and char_length(file_path) between 3 and 300 and file_path !~ '\.\.'),
  file_name text not null check (char_length(file_name) between 1 and 200),
  file_size bigint check (file_size is null or file_size >= 0),
  mime_type text,
  uploaded_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.bundle_items (
  bundle_id uuid not null references public.products(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  position integer not null default 0,
  primary key (bundle_id, product_id),
  constraint bundle_items_not_self check (bundle_id <> product_id)
);

-- Manually configured "you may also like" links. Shown only when both products are published.
create table if not exists public.related_products (
  product_id uuid not null references public.products(id) on delete cascade,
  related_id uuid not null references public.products(id) on delete cascade,
  position integer not null default 0,
  primary key (product_id, related_id),
  constraint related_products_not_self check (product_id <> related_id)
);

-- Bundles hold non-bundle products only (no nesting, so access can't loop).
create or replace function public.check_bundle_item() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select product_type from public.products where id = new.bundle_id) is distinct from 'bundle' then raise exception 'bundle_items.bundle_id must be a bundle'; end if;
  if (select product_type from public.products where id = new.product_id) = 'bundle' then raise exception 'bundles cannot contain bundles'; end if;
  return new;
end; $$;
drop trigger if exists trg_check_bundle_item on public.bundle_items;
create trigger trg_check_bundle_item before insert or update on public.bundle_items for each row execute function public.check_bundle_item();

-- ═════════════════════════ ENTITLEMENTS ═════════════════════════
-- "This person may use this product." Course access itself is still the enrolment (all course RLS uses is_enrolled()),
-- which is created alongside the entitlement for course products and courses inside bundles.
create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  status text not null default 'active' check (status in ('active','revoked','refunded')),
  source text not null check (source in ('purchase','free','manual','bundle','gift')),
  payment_id uuid references public.payments(id) on delete set null,
  via_product_id uuid references public.products(id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, product_id)
);
create index if not exists entitlements_product_idx on public.entitlements (product_id, status);
create index if not exists entitlements_payment_idx on public.entitlements (payment_id);

-- Minimal download log (who, what, when): for rate limiting and support. No IPs.
create table if not exists public.product_downloads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists product_downloads_user_idx on public.product_downloads (user_id, created_at desc);
create index if not exists product_downloads_product_idx on public.product_downloads (product_id, created_at desc);

-- ═════════════════════════ AFFILIATES ═════════════════════════
create table if not exists public.affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null check (code ~ '^[a-z0-9][a-z0-9_-]{2,23}$'),
  status text not null default 'pending' check (status in ('pending','active','suspended','rejected')),
  commission_rate_bps integer not null default 1000 check (commission_rate_bps between 0 and 9000), -- 1000 = 10%
  payout_details text check (payout_details is null or char_length(payout_details) <= 500),
  notes text check (notes is null or char_length(notes) <= 2000),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists affiliates_user_key on public.affiliates (user_id);
create unique index if not exists affiliates_code_key on public.affiliates (code);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'affiliates_profile_fk') then
    alter table public.affiliates add constraint affiliates_profile_fk foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

create table if not exists public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  visitor_key text check (visitor_key is null or visitor_key ~ '^[a-f0-9]{64}$'), -- salted hash, for de-duplication only
  landing_path text check (landing_path is null or char_length(landing_path) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists affiliate_clicks_aff_idx on public.affiliate_clicks (affiliate_id, created_at desc);

-- ═════════════════════════ PAYMENTS: products, attribution, affiliates ═════════════════════════
alter table public.payments
  add column if not exists product_id uuid references public.products(id) on delete set null,
  add column if not exists affiliate_id uuid references public.affiliates(id) on delete set null,
  add column if not exists attribution jsonb not null default '{}'::jsonb,
  add column if not exists abandoned_notified_at timestamptz;
create index if not exists payments_product_idx on public.payments (product_id);
create index if not exists payments_affiliate_idx on public.payments (affiliate_id) where affiliate_id is not null;
create index if not exists payments_pending_idx on public.payments (created_at) where status = 'pending';

create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete restrict,
  payment_id uuid not null references public.payments(id) on delete restrict,
  amount_minor integer not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  rate_bps integer not null,
  status text not null default 'pending' check (status in ('pending','approved','paid','cancelled')),
  status_note text check (status_note is null or char_length(status_note) <= 300),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  paid_at timestamptz,
  cancelled_at timestamptz
);
create unique index if not exists affiliate_commissions_payment_key on public.affiliate_commissions (payment_id); -- one commission per payment, ever
create index if not exists affiliate_commissions_aff_idx on public.affiliate_commissions (affiliate_id, status);

-- ═════════════════════════ COUPONS: products + campaigns ═════════════════════════
alter table public.coupons add column if not exists campaign_id uuid references public.marketing_campaigns(id) on delete set null;
create table if not exists public.coupon_products (
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  primary key (coupon_id, product_id)
);
alter table public.coupon_redemptions add column if not exists product_id uuid references public.products(id) on delete set null;

-- ═════════════════════════ CONTACTS (CRM) ═════════════════════════
-- One marketing identity per email address. Linked to the account when there is one (never a second account).
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  user_id uuid references auth.users(id) on delete set null,
  first_name text check (first_name is null or char_length(first_name) <= 80),
  phone text check (phone is null or phone ~ '^[1-9][0-9]{7,14}$'),
  marketing_consent boolean not null default false,
  consent_at timestamptz,
  consent_source text check (consent_source is null or char_length(consent_source) <= 40),
  unsubscribed_at timestamptz,
  unsubscribe_token text not null default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  email_status text not null default 'ok' check (email_status in ('ok','bounced','complained')),
  whatsapp_opt_in boolean not null default false,
  whatsapp_opt_in_at timestamptz,
  source text check (source is null or char_length(source) <= 40),
  first_touch jsonb not null default '{}'::jsonb,
  last_touch jsonb not null default '{}'::jsonb,
  referred_by_affiliate uuid references public.affiliates(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists contacts_email_key on public.contacts (email);
create unique index if not exists contacts_user_key on public.contacts (user_id) where user_id is not null;
create unique index if not exists contacts_unsubscribe_token_key on public.contacts (unsubscribe_token);
create index if not exists contacts_marketable_idx on public.contacts (created_at) where marketing_consent and unsubscribed_at is null and email_status = 'ok';

create table if not exists public.contact_tags (
  contact_id uuid not null references public.contacts(id) on delete cascade,
  tag text not null check (tag ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  created_at timestamptz not null default now(),
  primary key (contact_id, tag)
);
create index if not exists contact_tags_tag_idx on public.contact_tags (tag);

create table if not exists public.contact_notes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists contact_notes_contact_idx on public.contact_notes (contact_id, created_at desc);
-- Lets the CRM show who wrote a note (profiles exist for every account).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contact_notes_author_profile_fk') then
    alter table public.contact_notes add constraint contact_notes_author_profile_fk foreign key (author_id) references public.profiles(id) on delete set null;
  end if;
end $$;

-- Saved audiences. The definition is a preset plus optional tag/lifecycle filters, evaluated live (no copied lists).
create table if not exists public.segments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  description text check (description is null or char_length(description) <= 300),
  definition jsonb not null default '{"preset":"all_subscribers"}'::jsonb check (jsonb_typeof(definition) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ═════════════════════════ EMAIL ═════════════════════════
create table if not exists public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  subject text not null check (char_length(subject) between 1 and 160),
  preview_text text check (preview_text is null or char_length(preview_text) <= 200),
  from_name text check (from_name is null or char_length(from_name) <= 60),
  body text not null default '' check (char_length(body) <= 30000),
  segment_id uuid references public.segments(id) on delete set null,
  audience jsonb not null default '{"preset":"all_subscribers"}'::jsonb check (jsonb_typeof(audience) = 'object'),
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','scheduled','sending','sent','cancelled')),
  scheduled_at timestamptz,
  started_at timestamptz,
  sent_at timestamptz,
  recipients_count integer not null default 0,
  ai_assisted boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists email_campaigns_status_idx on public.email_campaigns (status, scheduled_at);

-- Every email sent to a contact by a campaign or an automation. Metrics come only from these rows (provider events).
create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('campaign','automation','test')),
  campaign_id uuid references public.email_campaigns(id) on delete cascade,
  automation_run_id uuid,
  contact_id uuid references public.contacts(id) on delete cascade,
  to_email text not null,
  subject text not null,
  body text,                                  -- automation emails only (campaign bodies live on the campaign)
  provider text,
  provider_message_id text,
  status text not null default 'queued' check (status in ('queued','sending','sent','failed','skipped')),
  attempts integer not null default 0,
  error text check (error is null or char_length(error) <= 300),
  send_after timestamptz,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  bounced_at timestamptz,
  complained_at timestamptz,
  unsubscribed_at timestamptz,
  updated_at timestamptz not null default now()
);
create unique index if not exists email_messages_campaign_contact_key on public.email_messages (campaign_id, contact_id) where campaign_id is not null and kind = 'campaign';
create unique index if not exists email_messages_provider_key on public.email_messages (provider_message_id) where provider_message_id is not null;
create index if not exists email_messages_queue_idx on public.email_messages (queued_at) where status = 'queued';
create index if not exists email_messages_campaign_idx on public.email_messages (campaign_id, status);
create index if not exists email_messages_sent_idx on public.email_messages (sent_at);

-- ═════════════════════════ AUTOMATIONS ═════════════════════════
-- Steps run strictly forward (a condition can only skip ahead), at most 20 steps: no loops are possible.
create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  trigger_event text not null check (trigger_event in ('user_registered','product_purchased','ebook_purchased','course_enrolled','course_completed','coupon_used','checkout_abandoned')),
  status text not null default 'draft' check (status in ('draft','active','paused')),
  steps jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) <= 20),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  trigger_ref text not null default '',
  status text not null default 'active' check (status in ('active','running','waiting','completed','failed','cancelled')),
  step_index integer not null default 0,
  steps_executed integer not null default 0,
  next_run_at timestamptz not null default now(),
  last_error text check (last_error is null or char_length(last_error) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (automation_id, contact_id, trigger_ref)          -- the same event never starts the same automation twice
);
create index if not exists automation_runs_due_idx on public.automation_runs (next_run_at) where status in ('active','waiting');

create table if not exists public.automation_logs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.automation_runs(id) on delete cascade,
  step_index integer not null,
  action text not null check (char_length(action) <= 40),
  outcome text not null check (outcome in ('done','skipped','waiting','failed','completed')),
  detail text check (detail is null or char_length(detail) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists automation_logs_run_idx on public.automation_logs (run_id, created_at);

-- ═════════════════════════ CONTENT CAMPAIGN MANAGER ═════════════════════════
-- Planned social posts. Nothing here is ever published automatically.
create table if not exists public.content_posts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  platform text not null check (platform in ('instagram','x','linkedin','youtube','facebook','whatsapp','tiktok','other')),
  title text not null check (char_length(title) between 1 and 120),
  copy text check (copy is null or char_length(copy) <= 5000),
  creative_url text check (creative_url is null or creative_url ~ '^(https://|/)'),
  cta_label text check (cta_label is null or char_length(cta_label) <= 60),
  cta_url text check (cta_url is null or cta_url ~ '^(https://|/)'),
  utm_source text, utm_medium text, utm_campaign text, utm_content text, utm_term text,
  scheduled_for timestamptz,
  published_url text check (published_url is null or published_url ~ '^https://'),
  status text not null default 'draft' check (status in ('draft','scheduled','published','archived')),
  ai_assisted boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists content_posts_campaign_idx on public.content_posts (campaign_id, scheduled_for);

-- ═════════════════════════ WHATSAPP FOUNDATION ═════════════════════════
-- Log only. Nothing is sent unless a provider is configured AND the contact opted in (enforced in server code too).
create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete set null,
  to_phone text not null check (to_phone ~ '^[1-9][0-9]{7,14}$'),
  kind text not null check (kind in ('transactional','marketing','test')),
  template text check (template is null or char_length(template) <= 100),
  provider text,
  provider_message_id text,
  status text not null default 'queued' check (status in ('queued','sent','delivered','read','failed')),
  error text check (error is null or char_length(error) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists whatsapp_messages_provider_key on public.whatsapp_messages (provider_message_id) where provider_message_id is not null;

-- Generic server-side rate limiting for public endpoints (newsletter sign-up, unsubscribe). Hashed keys only.
create table if not exists public.rate_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind ~ '^[a-z_]{3,40}$'),
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create index if not exists rate_events_idx on public.rate_events (kind, key_hash, created_at desc);

-- AI marketing assistant uses the Batch 2 log.
alter table public.ai_generations drop constraint if exists ai_generations_kind_check;
alter table public.ai_generations add constraint ai_generations_kind_check
  check (kind in ('quiz','regenerate','content','lesson_assistant','tutor','chatbot','marketing'));

-- ═════════════════════════ updated_at triggers ═════════════════════════
do $$
declare t text;
begin
  foreach t in array array['marketing_campaigns','products','product_prices','product_files','affiliates','contacts','segments','email_campaigns','email_messages','automations','automation_runs','content_posts','whatsapp_messages'] loop
    execute format('drop trigger if exists trg_%1$s_updated on public.%1$I', t);
    execute format('create trigger trg_%1$s_updated before update on public.%1$I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ═════════════════════════ CONTACT SYNC (accounts → contacts) ═════════════════════════
create or replace function public.contact_for_user(p_user uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.contacts where user_id = p_user;
$$;

-- Automations are queued here. Never raises: marketing must never block a payment, sign-up or enrolment.
create or replace function public.enqueue_automations(p_event text, p_contact uuid, p_ref text) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer := 0;
begin
  if p_contact is null then return 0; end if;
  begin
    insert into public.automation_runs (automation_id, contact_id, trigger_ref, status, step_index, next_run_at)
    select a.id, p_contact, coalesce(left(p_ref, 80), ''), 'active', 0, now()
    from public.automations a where a.status = 'active' and a.trigger_event = p_event and jsonb_array_length(a.steps) > 0
    on conflict (automation_id, contact_id, trigger_ref) do nothing;
    get diagnostics n = row_count;
  exception when others then
    n := 0;
  end;
  return n;
end; $$;

create or replace function public.sync_contact_from_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare cid uuid; addr text := lower(trim(coalesce(new.email, '')));
begin
  if addr = '' or addr !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return new; end if;
  select id into cid from public.contacts where user_id = new.id;
  if cid is not null then
    update public.contacts set email = addr where id = cid and email <> addr and not exists (select 1 from public.contacts c2 where c2.email = addr and c2.id <> cid);
  else
    update public.contacts set user_id = new.id, first_name = coalesce(first_name, nullif(new.first_name, ''))
      where email = addr and user_id is null returning id into cid;
    if cid is null then
      insert into public.contacts (email, user_id, first_name, source) values (addr, new.id, nullif(new.first_name, ''), 'account')
      on conflict do nothing returning id into cid;
    end if;
  end if;
  if tg_op = 'INSERT' and cid is not null then perform public.enqueue_automations('user_registered', cid, new.id::text); end if;
  return new;
end; $$;
drop trigger if exists trg_profiles_contact on public.profiles;
create trigger trg_profiles_contact after insert or update of email on public.profiles for each row execute function public.sync_contact_from_profile();

-- Existing accounts get a contact, consent OFF.
insert into public.contacts (email, user_id, first_name, source)
select distinct on (lower(p.email)) lower(p.email), p.id, nullif(p.first_name, ''), 'account'
from public.profiles p
where p.email is not null and lower(p.email) ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  and not exists (select 1 from public.contacts c where c.user_id = p.id or c.email = lower(p.email))
order by lower(p.email), p.created_at
on conflict do nothing;

-- Sign-up can carry an explicit, unticked-by-default marketing opt-in (user metadata marketing_consent = "true").
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, last_name, email)
  values (new.id,
          left(coalesce(new.raw_user_meta_data->>'first_name',''), 80),
          left(coalesce(new.raw_user_meta_data->>'last_name',''), 80),
          new.email)
  on conflict (id) do update set email = excluded.email;
  if coalesce(new.raw_user_meta_data->>'marketing_consent', '') = 'true' then
    update public.contacts set marketing_consent = true, consent_at = now(), consent_source = 'signup', unsubscribed_at = null where user_id = new.id;
  end if;
  return new;
end; $$;

-- ═════════════════════════ AUTOMATION TRIGGERS ═════════════════════════
create or replace function public.trg_entitlement_events() returns trigger
language plpgsql security definer set search_path = public as $$
declare cid uuid; ptype text;
begin
  if new.source in ('purchase','free','manual','gift') and new.status = 'active' then
    cid := public.contact_for_user(new.user_id);
    perform public.enqueue_automations('product_purchased', cid, new.product_id::text);
    select product_type into ptype from public.products where id = new.product_id;
    if ptype = 'ebook' then perform public.enqueue_automations('ebook_purchased', cid, new.product_id::text); end if;
  end if;
  return new;
end; $$;
drop trigger if exists trg_entitlements_events on public.entitlements;
create trigger trg_entitlements_events after insert on public.entitlements for each row execute function public.trg_entitlement_events();

create or replace function public.trg_enrolment_events() returns trigger
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  cid := public.contact_for_user(new.user_id);
  if tg_op = 'INSERT' and new.status = 'active' then
    perform public.enqueue_automations('course_enrolled', cid, new.course_id::text);
  elsif tg_op = 'UPDATE' and new.status = 'completed' and old.status is distinct from 'completed' then
    perform public.enqueue_automations('course_completed', cid, new.course_id::text);
  elsif tg_op = 'UPDATE' and new.status = 'active' and old.status not in ('active','completed') then
    perform public.enqueue_automations('course_enrolled', cid, new.course_id::text);
  end if;
  return new;
end; $$;
drop trigger if exists trg_enrolments_events on public.enrolments;
create trigger trg_enrolments_events after insert or update of status on public.enrolments for each row execute function public.trg_enrolment_events();

create or replace function public.trg_redemption_events() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null then perform public.enqueue_automations('coupon_used', public.contact_for_user(new.user_id), new.coupon_id::text); end if;
  return new;
end; $$;
drop trigger if exists trg_redemptions_events on public.coupon_redemptions;
create trigger trg_redemptions_events after insert on public.coupon_redemptions for each row execute function public.trg_redemption_events();

-- ═════════════════════════ PRICING, ACCESS, COUPONS ═════════════════════════
create or replace function public.product_price(p_product uuid, p_currency text) returns integer
language sql stable security definer set search_path = public as $$
  select case when pr.product_type = 'course'
    then (select cp.amount_minor from public.course_pricing cp where cp.course_id = pr.course_id and cp.currency = upper(p_currency) and cp.active)
    else (select pp.amount_minor from public.product_prices pp where pp.product_id = pr.id and pp.currency = upper(p_currency) and pp.active) end
  from public.products pr where pr.id = p_product;
$$;

create or replace function public.user_owns_product(p_user uuid, p_product uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.entitlements e where e.user_id = p_user and e.product_id = p_product and e.status = 'active')
      or exists (select 1 from public.products pr join public.enrolments en on en.course_id = pr.course_id
                 where pr.id = p_product and pr.product_type = 'course' and en.user_id = p_user and en.status in ('active','completed'));
$$;

-- For the signed-in person: may they open/download this product?
create or replace function public.can_access_product(p_product uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (public.user_owns_product(auth.uid(), p_product) or public.has_admin_permission('products'));
$$;

-- Shared coupon rules (dates, limits, currency, minimum, course/product restrictions). Never trusts the browser.
create or replace function public.coupon_evaluate(p_code text, p_user uuid, p_currency text, p_price integer, p_course uuid, p_product uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare cp record; used int; used_me int; disc int;
begin
  select * into cp from public.coupons where code = upper(trim(coalesce(p_code, '')));
  if not found or not cp.active then return jsonb_build_object('ok', false, 'error', 'coupon_invalid'); end if;
  if cp.starts_at is not null and cp.starts_at > now() then return jsonb_build_object('ok', false, 'error', 'coupon_not_started'); end if;
  if cp.expires_at is not null and cp.expires_at <= now() then return jsonb_build_object('ok', false, 'error', 'coupon_expired'); end if;
  if not cp.applies_to_all and not (
       (p_course is not null and exists (select 1 from public.coupon_courses where coupon_id = cp.id and course_id = p_course))
    or (p_product is not null and exists (select 1 from public.coupon_products where coupon_id = cp.id and product_id = p_product))) then
    return jsonb_build_object('ok', false, 'error', 'coupon_not_applicable');
  end if;
  if cp.currency is not null and cp.currency <> upper(p_currency) then return jsonb_build_object('ok', false, 'error', 'coupon_currency', 'coupon_currency', cp.currency); end if;
  if cp.min_amount_minor is not null and p_price < cp.min_amount_minor then return jsonb_build_object('ok', false, 'error', 'coupon_minimum'); end if;
  select count(*) into used from public.coupon_redemptions where coupon_id = cp.id;
  if cp.usage_limit is not null and used >= cp.usage_limit then return jsonb_build_object('ok', false, 'error', 'coupon_used_up'); end if;
  if p_user is not null then
    select count(*) into used_me from public.coupon_redemptions where coupon_id = cp.id and user_id = p_user;
    if cp.per_user_limit is not null and used_me >= cp.per_user_limit then return jsonb_build_object('ok', false, 'error', 'coupon_already_used'); end if;
  end if;
  disc := case when cp.discount_type = 'percentage' then floor(p_price::numeric * cp.discount_value / 100)::int else least(cp.discount_value, p_price) end;
  return jsonb_build_object('ok', true, 'coupon_id', cp.id, 'coupon_code', cp.code, 'discount', greatest(least(disc, p_price), 0));
end; $$;

-- ═════════════════════════ ATTRIBUTION HELPERS ═════════════════════════
-- Only these short string fields survive; anything else in the browser-supplied JSON is dropped.
create or replace function public.clean_touch(t jsonb) returns jsonb
language sql immutable set search_path = public as $$
  select case when jsonb_typeof(t) = 'object' then coalesce((
    select jsonb_object_agg(k, left(t->>k, 120))
    from unnest(array['source','medium','campaign','content','term','ref','landing','at']) as k
    where jsonb_typeof(t->k) = 'string' and length(t->>k) > 0), '{}'::jsonb)
  else '{}'::jsonb end;
$$;
create or replace function public.clean_attribution(a jsonb) returns jsonb
language sql immutable set search_path = public as $$
  select case when jsonb_typeof(a) = 'object' then jsonb_strip_nulls(jsonb_build_object(
    'first', nullif(public.clean_touch(a->'first'), '{}'::jsonb), 'last', nullif(public.clean_touch(a->'last'), '{}'::jsonb)))
  else '{}'::jsonb end;
$$;

-- Active affiliate for a referral code, never the buyer themselves (no self-referrals).
create or replace function public.resolve_affiliate(p_code text, p_user uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.affiliates
  where code = lower(trim(coalesce(p_code, ''))) and status = 'active' and user_id is distinct from p_user;
$$;

-- ═════════════════════════ ENTITLEMENT GRANTS ═════════════════════════
create or replace function public.grant_course_access(p_user uuid, p_course uuid, p_source text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.enrolments (user_id, course_id, status, source) values (p_user, p_course, 'active', p_source)
  on conflict (user_id, course_id) do update set
    status = case when public.enrolments.status in ('active','completed') then public.enrolments.status else 'active' end,
    source = case when public.enrolments.status in ('active','completed') then public.enrolments.source else excluded.source end;
end; $$;

-- Idempotent: re-granting an active entitlement changes nothing. Bundles grant every item (and course access).
create or replace function public.grant_product(p_user uuid, p_product uuid, p_payment uuid, p_source text) returns void
language plpgsql security definer set search_path = public as $$
declare pr record; it record; esrc text;
begin
  select * into pr from public.products where id = p_product;
  if not found or p_user is null then return; end if;
  insert into public.entitlements (user_id, product_id, status, source, payment_id) values (p_user, pr.id, 'active', p_source, p_payment)
  on conflict (user_id, product_id) do update set status = 'active', source = excluded.source, payment_id = coalesce(excluded.payment_id, public.entitlements.payment_id),
    revoked_at = null, via_product_id = null, granted_at = now()
  where public.entitlements.status <> 'active';
  esrc := case p_source when 'purchase' then 'paystack' when 'free' then 'free' when 'gift' then 'gift' else 'manual' end;
  if pr.product_type = 'course' then
    perform public.grant_course_access(p_user, pr.course_id, esrc);
  elsif pr.product_type = 'bundle' then
    for it in select p.* from public.bundle_items b join public.products p on p.id = b.product_id where b.bundle_id = pr.id order by b.position loop
      insert into public.entitlements (user_id, product_id, status, source, payment_id, via_product_id) values (p_user, it.id, 'active', 'bundle', p_payment, pr.id)
      on conflict (user_id, product_id) do update set status = 'active', source = 'bundle', payment_id = excluded.payment_id, via_product_id = excluded.via_product_id, revoked_at = null
      where public.entitlements.status <> 'active';
      if it.product_type = 'course' then perform public.grant_course_access(p_user, it.course_id, esrc); end if;
    end loop;
  end if;
end; $$;

-- ═════════════════════════ PRODUCT CHECKOUT ═════════════════════════
create or replace function public.product_checkout_quote(p_product uuid, p_currency text, p_code text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare pr record; price int; cur text := upper(coalesce(p_currency, '')); ev jsonb; disc int := 0; v_cid uuid; v_code text; cslug text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'sign_in'); end if;
  select * into pr from public.products where id = p_product;
  if not found or pr.status <> 'published' then return jsonb_build_object('ok', false, 'error', 'not_available'); end if;
  if pr.product_type = 'course' then
    select slug into cslug from public.courses where id = pr.course_id and status = 'published';
    if cslug is null then return jsonb_build_object('ok', false, 'error', 'not_available'); end if;
  end if;
  if pr.product_type = 'bundle' and not exists (select 1 from public.bundle_items where bundle_id = pr.id) then return jsonb_build_object('ok', false, 'error', 'not_available'); end if;
  if pr.product_type in ('ebook','guide','template','download') and not exists (select 1 from public.product_files where product_id = pr.id) then
    return jsonb_build_object('ok', false, 'error', 'not_available');
  end if;
  if public.user_owns_product(auth.uid(), pr.id) then return jsonb_build_object('ok', false, 'error', 'already_owned'); end if;
  price := public.product_price(pr.id, cur);
  if price is null then return jsonb_build_object('ok', false, 'error', 'no_price'); end if;
  if nullif(trim(coalesce(p_code, '')), '') is not null then
    ev := public.coupon_evaluate(p_code, auth.uid(), cur, price, pr.course_id, pr.id);
    if not (ev->>'ok')::boolean then return ev; end if;
    disc := (ev->>'discount')::int; v_cid := (ev->>'coupon_id')::uuid; v_code := ev->>'coupon_code';
  end if;
  return jsonb_build_object('ok', true, 'product_id', pr.id, 'product_name', pr.name, 'product_type', pr.product_type, 'product_slug', pr.slug,
                            'course_id', pr.course_id, 'course_slug', cslug, 'currency', cur, 'base', price, 'discount', disc,
                            'total', greatest(price - disc, 0), 'coupon_id', v_cid, 'coupon_code', v_code);
end; $$;

create or replace function public.create_product_checkout(p_product uuid, p_currency text, p_code text default null, p_ref text default null, p_attribution jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q jsonb; ref text; pid uuid; recent int; email text; total int; aff uuid; attr jsonb;
begin
  q := public.product_checkout_quote(p_product, p_currency, p_code);
  if not (q->>'ok')::boolean then return q; end if;
  select count(*) into recent from public.payments where user_id = auth.uid() and status = 'pending' and created_at > now() - interval '1 hour';
  if recent >= 10 then return jsonb_build_object('ok', false, 'error', 'too_many'); end if;
  select u.email into email from auth.users u where u.id = auth.uid();
  total := (q->>'total')::int;
  aff := public.resolve_affiliate(p_ref, auth.uid());
  attr := public.clean_attribution(coalesce(p_attribution, '{}'::jsonb));
  ref := 'FA-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  if total = 0 then
    insert into public.payments (user_id, course_id, product_id, reference, amount_minor, base_amount_minor, discount_minor, coupon_id, currency, provider, status, paid_at, verified_at, attribution)
    values (auth.uid(), (q->>'course_id')::uuid, p_product, ref, 0, (q->>'base')::int, (q->>'discount')::int, (q->>'coupon_id')::uuid, q->>'currency', 'free', 'successful', now(), now(), attr)
    returning id into pid;
    perform public.grant_product(auth.uid(), p_product, pid, 'free');
    if q->>'coupon_id' is not null then
      insert into public.coupon_redemptions (coupon_id, user_id, course_id, product_id, payment_id, discount_minor, currency)
      values ((q->>'coupon_id')::uuid, auth.uid(), (q->>'course_id')::uuid, p_product, pid, (q->>'discount')::int, q->>'currency') on conflict (payment_id) do nothing;
    end if;
    return q || jsonb_build_object('free', true, 'reference', ref);
  end if;

  insert into public.payments (user_id, course_id, product_id, reference, amount_minor, base_amount_minor, discount_minor, coupon_id, currency, provider, status, affiliate_id, attribution)
  values (auth.uid(), (q->>'course_id')::uuid, p_product, ref, total, (q->>'base')::int, (q->>'discount')::int, (q->>'coupon_id')::uuid, q->>'currency', 'paystack', 'pending', aff, attr);
  return q || jsonb_build_object('free', false, 'reference', ref, 'email', email);
end; $$;

-- Course checkout (Batch 1 create_checkout) stays as is; this attaches referral + UTM data to the caller's own pending payment.
create or replace function public.attach_checkout_attribution(p_reference text, p_ref text, p_attribution jsonb) returns void
language sql security definer set search_path = public as $$
  update public.payments set affiliate_id = coalesce(affiliate_id, public.resolve_affiliate(p_ref, auth.uid())),
    attribution = case when attribution = '{}'::jsonb then public.clean_attribution(coalesce(p_attribution, '{}'::jsonb)) else attribution end
  where reference = p_reference and user_id = auth.uid() and status = 'pending';
$$;

-- Commission on the amount actually paid. One per payment, active affiliates only, never for the affiliate's own purchase.
create or replace function public.record_commission(p_payment uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select pay.id, pay.user_id, pay.amount_minor, pay.currency, pay.status, a.id as aff_id, a.user_id as aff_user, a.status as aff_status, a.commission_rate_bps
    into r from public.payments pay join public.affiliates a on a.id = pay.affiliate_id where pay.id = p_payment;
  if not found or r.status <> 'successful' or r.aff_status <> 'active' or r.aff_user = r.user_id or r.amount_minor <= 0 then return; end if;
  insert into public.affiliate_commissions (affiliate_id, payment_id, amount_minor, currency, rate_bps, status)
  values (r.aff_id, r.id, floor(r.amount_minor::numeric * r.commission_rate_bps / 10000)::int, r.currency, r.commission_rate_bps, 'pending')
  on conflict (payment_id) do nothing;
end; $$;

-- ───────────── fulfilment: SERVER ONLY. Superset of 0005: same course behaviour + products + commissions. ─────────────
create or replace function public.fulfill_payment(p_reference text, p_amount integer, p_currency text, p_paid_at timestamptz, p_channel text, p_transaction_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select * into p from public.payments where reference = p_reference for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if p.status = 'successful' then
    return jsonb_build_object('ok', true, 'already', true, 'payment_id', p.id, 'user_id', p.user_id, 'course_id', p.course_id, 'product_id', p.product_id);
  end if;
  if p.status = 'refunded' then return jsonb_build_object('ok', false, 'error', 'refunded'); end if;
  if p_amount is distinct from p.amount_minor or upper(p_currency) is distinct from p.currency then
    update public.payments set status = 'failed', failure_reason = 'amount_mismatch',
      metadata = metadata || jsonb_build_object('received_amount', p_amount, 'received_currency', p_currency) where id = p.id;
    return jsonb_build_object('ok', false, 'error', 'amount_mismatch');
  end if;

  update public.payments set status = 'successful', paid_at = coalesce(p_paid_at, now()), verified_at = now(), channel = left(p_channel, 40),
    provider_transaction_id = left(p_transaction_id, 40), failure_reason = null where id = p.id;
  if p.user_id is not null and p.course_id is not null then
    perform public.grant_course_access(p.user_id, p.course_id, 'paystack');
  end if;
  if p.user_id is not null and p.product_id is not null then
    perform public.grant_product(p.user_id, p.product_id, p.id, 'purchase');
  end if;
  if p.coupon_id is not null then
    insert into public.coupon_redemptions (coupon_id, user_id, course_id, product_id, payment_id, discount_minor, currency)
    values (p.coupon_id, p.user_id, p.course_id, p.product_id, p.id, p.discount_minor, p.currency) on conflict (payment_id) do nothing;
  end if;
  if p.affiliate_id is not null then perform public.record_commission(p.id); end if;
  insert into public.activity_logs (actor_id, actor_email, action, resource_type, resource_id, resource_label, metadata)
  values (null, null, 'payment verified', 'payment', p.id::text, p.reference, jsonb_build_object('amount_minor', p.amount_minor, 'currency', p.currency));
  return jsonb_build_object('ok', true, 'already', false, 'payment_id', p.id, 'user_id', p.user_id, 'course_id', p.course_id, 'product_id', p.product_id);
end; $$;

-- Refund (already made in Paystack): payment, its enrolment(s) and entitlements → refunded; unpaid commission cancelled.
create or replace function public.admin_record_refund(p_payment uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  if not public.has_admin_permission('payments') then raise exception 'not authorised'; end if;
  select * into p from public.payments where id = p_payment for update;
  if not found or p.status <> 'successful' then raise exception 'only successful payments can be refunded'; end if;
  update public.payments set status = 'refunded' where id = p.id;
  update public.enrolments set status = 'refunded' where user_id = p.user_id and (course_id = p.course_id or course_id in (
    select pr.course_id from public.entitlements e join public.products pr on pr.id = e.product_id where e.payment_id = p.id and pr.course_id is not null));
  update public.entitlements set status = 'refunded', revoked_at = now() where payment_id = p.id and status = 'active';
  update public.affiliate_commissions set status = 'cancelled', cancelled_at = now(), status_note = 'payment refunded'
    where payment_id = p.id and status in ('pending','approved');
end; $$;

-- Secure download: access check + rate limit (20 per hour per person) + log. Returns the private path for signing.
create or replace function public.prepare_product_download(p_product uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare f record; recent int;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'sign_in'); end if;
  if not public.can_access_product(p_product) then return jsonb_build_object('ok', false, 'error', 'no_access'); end if;
  select * into f from public.product_files where product_id = p_product;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_file'); end if;
  select count(*) into recent from public.product_downloads where user_id = auth.uid() and created_at > now() - interval '1 hour';
  if recent >= 20 then return jsonb_build_object('ok', false, 'error', 'rate_limited'); end if;
  insert into public.product_downloads (user_id, product_id) values (auth.uid(), p_product);
  return jsonb_build_object('ok', true, 'file_path', f.file_path, 'file_name', f.file_name);
end; $$;

-- Admin: give or remove access (customer support). Audit logging happens in the server action.
create or replace function public.admin_grant_product(p_user uuid, p_product uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_permission('customers') then raise exception 'not authorised'; end if;
  if not exists (select 1 from public.products where id = p_product) then raise exception 'no such product'; end if;
  perform public.grant_product(p_user, p_product, null, 'manual');
end; $$;
create or replace function public.admin_revoke_entitlement(p_entitlement uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_permission('customers') then raise exception 'not authorised'; end if;
  update public.entitlements set status = 'revoked', revoked_at = now() where id = p_entitlement and status = 'active';
  if not found then raise exception 'not active'; end if;
end; $$;

-- ═════════════════════════ LIFECYCLE + SEGMENTS ═════════════════════════
create or replace function public.contact_lifecycle(p_contact uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare c record; paid int := 0; owns boolean := false; enrolled boolean := false; last_seen timestamptz;
begin
  select ct.*, p.last_active_at into c from public.contacts ct left join public.profiles p on p.id = ct.user_id where ct.id = p_contact;
  if not found then return null; end if;
  if c.user_id is not null then
    select count(*) into paid from public.payments where user_id = c.user_id and status = 'successful' and amount_minor > 0;
    select exists (select 1 from public.enrolments where user_id = c.user_id and status in ('active','completed')) into enrolled;
    select enrolled or exists (select 1 from public.entitlements where user_id = c.user_id and status = 'active') into owns;
    select greatest(c.last_active_at, (select max(paid_at) from public.payments where user_id = c.user_id and status = 'successful')) into last_seen;
  end if;
  if not owns and paid = 0 then return 'lead'; end if;
  if coalesce(last_seen, c.created_at) < now() - interval '90 days' then return 'inactive'; end if;
  if paid >= 2 then return 'repeat_customer'; end if;
  if enrolled then return 'student'; end if;
  return 'customer';
end; $$;

-- Live audience. Presets are fixed SQL (no user-supplied SQL). Marketing sends additionally filter consent.
create or replace function public.segment_contacts(p_def jsonb) returns table (contact_id uuid)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare preset text := coalesce(p_def->>'preset', 'all_subscribers'); lc text := nullif(p_def->>'lifecycle', '');
        tags_any text[]; tags_none text[];
begin
  -- Service role (no auth.uid()) or an admin allowed to use audiences.
  if auth.uid() is not null and not (public.has_admin_permission('marketing') or public.has_admin_permission('customers')) then raise exception 'not authorised'; end if;
  select coalesce(array_agg(x), '{}') into tags_any from jsonb_array_elements_text(case when jsonb_typeof(p_def->'tags_any') = 'array' then p_def->'tags_any' else '[]'::jsonb end) x;
  select coalesce(array_agg(x), '{}') into tags_none from jsonb_array_elements_text(case when jsonb_typeof(p_def->'tags_none') = 'array' then p_def->'tags_none' else '[]'::jsonb end) x;
  return query
  select c.id from public.contacts c
  where case preset
      when 'all_contacts' then true
      when 'all_subscribers' then c.marketing_consent and c.unsubscribed_at is null
      when 'ebook_buyers' then exists (select 1 from public.entitlements e join public.products p on p.id = e.product_id where e.user_id = c.user_id and e.status = 'active' and p.product_type = 'ebook')
      when 'product_buyers' then exists (select 1 from public.entitlements e where e.user_id = c.user_id and e.status = 'active')
      when 'course_students' then exists (select 1 from public.enrolments en where en.user_id = c.user_id and en.status in ('active','completed'))
      when 'never_purchased' then not exists (select 1 from public.payments pay where pay.user_id = c.user_id and pay.status = 'successful')
                              and not exists (select 1 from public.entitlements e where e.user_id = c.user_id and e.status = 'active')
      when 'ebook_not_course' then exists (select 1 from public.entitlements e join public.products p on p.id = e.product_id where e.user_id = c.user_id and e.status = 'active' and p.product_type = 'ebook')
                               and not exists (select 1 from public.enrolments en where en.user_id = c.user_id and en.status in ('active','completed'))
      when 'completed_course' then exists (select 1 from public.enrolments en where en.user_id = c.user_id and en.status = 'completed')
      when 'inactive_students' then exists (select 1 from public.enrolments en where en.user_id = c.user_id and en.status = 'active')
                                and coalesce((select last_active_at from public.profiles where id = c.user_id), c.created_at) < now() - interval '30 days'
      when 'recent_customers' then exists (select 1 from public.payments pay where pay.user_id = c.user_id and pay.status = 'successful' and pay.paid_at > now() - interval '30 days')
      when 'leads' then c.user_id is null or (not exists (select 1 from public.payments pay where pay.user_id = c.user_id and pay.status = 'successful')
                                               and not exists (select 1 from public.enrolments en where en.user_id = c.user_id))
      when 'affiliate_referrals' then c.referred_by_affiliate is not null
      else false end
    and (cardinality(tags_any) = 0 or exists (select 1 from public.contact_tags t where t.contact_id = c.id and t.tag = any (tags_any)))
    and (cardinality(tags_none) = 0 or not exists (select 1 from public.contact_tags t where t.contact_id = c.id and t.tag = any (tags_none)))
    and (lc is null or public.contact_lifecycle(c.id) = lc);
end; $$;

-- How many people a definition reaches, and how many of them can receive marketing email.
create or replace function public.segment_count(p_def jsonb) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('total', count(*), 'marketable', count(*) filter (where c.marketing_consent and c.unsubscribed_at is null and c.email_status = 'ok'))
  from public.segment_contacts(p_def) s join public.contacts c on c.id = s.contact_id;
$$;

-- Admin CRM list. security_invoker: rows only for staff whose RLS allows contacts.
create or replace view public.customer_overview with (security_invoker = true) as
select c.id, c.email, c.user_id,
       coalesce(nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), ''), c.first_name) as name,
       c.marketing_consent, c.unsubscribed_at, c.email_status, c.source, c.first_touch, c.last_touch, c.referred_by_affiliate, c.created_at,
       p.last_active_at,
       public.contact_lifecycle(c.id) as lifecycle,
       (select count(*) from public.payments pay where pay.user_id = c.user_id and pay.status = 'successful') as orders,
       (select array_agg(t.tag order by t.tag) from public.contact_tags t where t.contact_id = c.id) as tags
from public.contacts c left join public.profiles p on p.id = c.user_id;

-- ═════════════════════════ CONSENT + UNSUBSCRIBE ═════════════════════════
create or replace function public.set_my_marketing_consent(p_on boolean) returns void
language sql security definer set search_path = public as $$
  update public.contacts set marketing_consent = p_on,
    consent_at = case when p_on then now() else consent_at end, consent_source = case when p_on then 'account_settings' else consent_source end,
    unsubscribed_at = case when p_on then null else now() end
  where user_id = auth.uid();
$$;

-- Token-based (no sign-in needed), SERVER ONLY. Records which email the unsubscribe came from when known.
create or replace function public.unsubscribe_by_token(p_token text, p_message uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return jsonb_build_object('ok', false); end if;
  update public.contacts set marketing_consent = false, unsubscribed_at = coalesce(unsubscribed_at, now()) where unsubscribe_token = p_token returning id into cid;
  if cid is null then return jsonb_build_object('ok', false); end if;
  if p_message is not null then
    update public.email_messages set unsubscribed_at = coalesce(unsubscribed_at, now()) where id = p_message and contact_id = cid;
  end if;
  update public.automation_runs set status = 'cancelled', last_error = 'unsubscribed' where contact_id = cid and status in ('active','waiting');
  return jsonb_build_object('ok', true);
end; $$;

-- ═════════════════════════ EMAIL QUEUE (server only) ═════════════════════════
create or replace function public.start_email_campaign(p_campaign uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare c record; n int;
begin
  if auth.uid() is not null and not public.has_admin_permission('marketing') then raise exception 'not authorised'; end if;
  select * into c from public.email_campaigns where id = p_campaign for update;
  if not found or c.status not in ('draft','scheduled') then raise exception 'campaign cannot be sent in its current state'; end if;
  insert into public.email_messages (kind, campaign_id, contact_id, to_email, subject, status)
  select 'campaign', c.id, ct.id, ct.email, c.subject, 'queued'
  from public.segment_contacts(coalesce((select definition from public.segments where id = c.segment_id), c.audience)) s
  join public.contacts ct on ct.id = s.contact_id
  where ct.marketing_consent and ct.unsubscribed_at is null and ct.email_status = 'ok'
  on conflict do nothing;
  get diagnostics n = row_count;
  update public.email_campaigns set status = 'sending', started_at = now(), recipients_count = recipients_count + n where id = c.id;
  return n;
end; $$;

create or replace function public.claim_email_messages(p_limit integer) returns setof public.email_messages
language plpgsql security definer set search_path = public as $$
begin
  -- Anything stuck in "sending" for 15 minutes (a crashed run) goes back to the queue, at most 3 attempts in total.
  update public.email_messages set status = case when attempts >= 3 then 'failed' else 'queued' end, error = coalesce(error, 'timed out')
  where status = 'sending' and updated_at < now() - interval '15 minutes';
  return query
  update public.email_messages m set status = 'sending', attempts = m.attempts + 1
  where m.id in (select id from public.email_messages where status = 'queued' and (send_after is null or send_after <= now())
                 order by queued_at limit greatest(1, least(coalesce(p_limit, 100), 500)) for update skip locked)
  returning m.*;
end; $$;

create or replace function public.finish_email_campaigns() returns integer
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.email_campaigns c set status = 'sent', sent_at = now()
  where c.status = 'sending' and not exists (select 1 from public.email_messages m where m.campaign_id = c.id and m.status in ('queued','sending'));
  get diagnostics n = row_count;
  return n;
end; $$;

-- Provider webhook events (delivered / opened / clicked / bounced / complained). Never creates rows; only timestamps.
create or replace function public.record_email_event(p_provider_id text, p_type text, p_at timestamptz) returns boolean
language plpgsql security definer set search_path = public as $$
declare m record; at timestamptz := coalesce(p_at, now());
begin
  select * into m from public.email_messages where provider_message_id = p_provider_id;
  if not found then return false; end if;
  case p_type
    when 'delivered' then update public.email_messages set delivered_at = coalesce(delivered_at, at) where id = m.id;
    when 'opened' then update public.email_messages set opened_at = coalesce(opened_at, at) where id = m.id;
    when 'clicked' then update public.email_messages set clicked_at = coalesce(clicked_at, at), opened_at = coalesce(opened_at, at) where id = m.id;
    when 'bounced' then
      update public.email_messages set bounced_at = coalesce(bounced_at, at) where id = m.id;
      update public.contacts set email_status = 'bounced' where id = m.contact_id and email_status = 'ok';
    when 'complained' then
      update public.email_messages set complained_at = coalesce(complained_at, at) where id = m.id;
      update public.contacts set email_status = 'complained', marketing_consent = false, unsubscribed_at = coalesce(unsubscribed_at, at) where id = m.contact_id;
    else return false;
  end case;
  return true;
end; $$;

-- Automation runs due now, claimed exclusively (concurrent cron runs never execute the same run twice).
create or replace function public.claim_automation_runs(p_limit integer) returns setof public.automation_runs
language plpgsql security definer set search_path = public as $$
begin
  update public.automation_runs set status = 'active' where status = 'running' and updated_at < now() - interval '15 minutes';
  return query
  update public.automation_runs r set status = 'running'
  where r.id in (select id from public.automation_runs where status in ('active','waiting') and next_run_at <= now()
                 order by next_run_at limit greatest(1, least(coalesce(p_limit, 50), 200)) for update skip locked)
  returning r.*;
end; $$;

-- Abandoned checkout: pending card payments older than p_after (max 7 days), not followed by a purchase of the same thing.
-- Queues the "checkout_abandoned" automation once per payment. Sending still requires marketing consent.
create or replace function public.flag_abandoned_checkouts(p_after interval default interval '2 hours') returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n int := 0;
begin
  for r in select * from public.payments where status = 'pending' and provider = 'paystack' and user_id is not null and abandoned_notified_at is null
             and created_at < now() - p_after and created_at > now() - interval '7 days' for update skip locked loop
    update public.payments set abandoned_notified_at = now() where id = r.id;
    if exists (select 1 from public.payments s where s.user_id = r.user_id and s.status = 'successful' and s.created_at >= r.created_at
               and (s.product_id is not distinct from r.product_id) and (s.course_id is not distinct from r.course_id)) then continue; end if;
    n := n + public.enqueue_automations('checkout_abandoned', public.contact_for_user(r.user_id), r.reference);
  end loop;
  return n;
end; $$;

-- ═════════════════════════ AFFILIATE (self-service) ═════════════════════════
create or replace function public.apply_affiliate(p_code text, p_payout text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c text := lower(trim(coalesce(p_code, '')));
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'sign_in'); end if;
  if exists (select 1 from public.affiliates where user_id = auth.uid()) then return jsonb_build_object('ok', false, 'error', 'exists'); end if;
  if c !~ '^[a-z0-9][a-z0-9_-]{2,23}$' then return jsonb_build_object('ok', false, 'error', 'bad_code'); end if;
  if exists (select 1 from public.affiliates where code = c) then return jsonb_build_object('ok', false, 'error', 'code_taken'); end if;
  insert into public.affiliates (user_id, code, status, payout_details) values (auth.uid(), c, 'pending', left(nullif(trim(coalesce(p_payout, '')), ''), 500));
  return jsonb_build_object('ok', true);
end; $$;

create or replace function public.update_my_affiliate_payout(p_payout text) returns void
language sql security definer set search_path = public as $$
  update public.affiliates set payout_details = left(nullif(trim(coalesce(p_payout, '')), ''), 500) where user_id = auth.uid();
$$;

-- The affiliate's own numbers. Never includes buyers' identities or other affiliates' data.
create or replace function public.my_affiliate_summary() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a record;
begin
  select * into a from public.affiliates where user_id = auth.uid();
  if not found then return null; end if;
  return jsonb_build_object(
    'code', a.code, 'status', a.status, 'rate_bps', a.commission_rate_bps, 'payout_details', a.payout_details, 'created_at', a.created_at,
    'clicks_total', (select count(*) from public.affiliate_clicks where affiliate_id = a.id),
    'clicks_30d', (select count(*) from public.affiliate_clicks where affiliate_id = a.id and created_at > now() - interval '30 days'),
    'conversions', (select count(*) from public.affiliate_commissions where affiliate_id = a.id and status <> 'cancelled'),
    'sales', (select coalesce(jsonb_object_agg(currency, total), '{}'::jsonb) from (
       select pay.currency, sum(pay.amount_minor) as total from public.affiliate_commissions ac join public.payments pay on pay.id = ac.payment_id
       where ac.affiliate_id = a.id and ac.status <> 'cancelled' group by pay.currency) s),
    'commission', (select coalesce(jsonb_agg(jsonb_build_object('status', status, 'currency', currency, 'amount', total)), '[]'::jsonb) from (
       select status, currency, sum(amount_minor) as total from public.affiliate_commissions where affiliate_id = a.id group by status, currency) s),
    'recent', (select coalesce(jsonb_agg(jsonb_build_object('created_at', created_at, 'amount', amount_minor, 'currency', currency, 'status', status) order by created_at desc), '[]'::jsonb)
       from (select * from public.affiliate_commissions where affiliate_id = a.id order by created_at desc limit 20) r)
  );
end; $$;

-- Referral link visits. De-duplicated per visitor per 30 minutes and capped per affiliate per hour (abuse guard).
create or replace function public.record_affiliate_click(p_code text, p_path text, p_visitor text) returns void
language plpgsql security definer set search_path = public as $$
declare aid uuid; v text := case when p_visitor ~ '^[a-f0-9]{64}$' then p_visitor end;
begin
  select id into aid from public.affiliates where code = lower(trim(coalesce(p_code, ''))) and status = 'active';
  if aid is null then return; end if;
  if v is not null and exists (select 1 from public.affiliate_clicks where affiliate_id = aid and visitor_key = v and created_at > now() - interval '30 minutes') then return; end if;
  if (select count(*) from public.affiliate_clicks where affiliate_id = aid and created_at > now() - interval '1 hour') >= 1000 then return; end if;
  insert into public.affiliate_clicks (affiliate_id, visitor_key, landing_path) values (aid, v, left(regexp_replace(coalesce(p_path, ''), '[^A-Za-z0-9/_.-]', '', 'g'), 200));
end; $$;

-- ═════════════════════════ ANALYTICS (real rows only) ═════════════════════════
create or replace function public.marketing_stats(p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare money boolean := public.has_admin_permission('payments'); res jsonb;
begin
  if not (public.has_admin_permission('marketing') or money) then raise exception 'not authorised'; end if;
  with paid as (select * from public.payments where status = 'successful' and coalesce(paid_at, created_at) >= p_from and coalesce(paid_at, created_at) < p_to),
       started as (select * from public.payments where created_at >= p_from and created_at < p_to and provider in ('paystack','free'))
  select jsonb_build_object(
    'can_see_revenue', money,
    'orders', (select count(*) from paid),
    'paid_orders', (select count(*) from paid where amount_minor > 0),
    'checkouts_started', (select count(*) from started),
    'checkouts_completed', (select count(*) from started where status = 'successful'),
    'customers', (select count(distinct user_id) from paid),
    'new_contacts', (select count(*) from public.contacts where created_at >= p_from and created_at < p_to),
    'subscribers', (select count(*) from public.contacts where marketing_consent and unsubscribed_at is null and email_status = 'ok'),
    'revenue', case when money then (select coalesce(jsonb_object_agg(currency, t), '{}'::jsonb) from (select currency, sum(amount_minor) as t from paid group by currency) x) end,
    'product_sales', (select coalesce(jsonb_agg(x order by x.orders desc), '[]'::jsonb) from (
        select coalesce(pr.name, co.title, 'Other') as name, coalesce(pr.product_type, case when co.id is not null then 'course' end) as type, paid.currency,
               count(*) as orders, case when money then sum(paid.amount_minor) end as revenue
        from paid left join public.products pr on pr.id = paid.product_id left join public.courses co on co.id = paid.course_id
        group by 1, 2, 3 limit 50) x),
    'coupons', (select coalesce(jsonb_agg(x order by x.uses desc), '[]'::jsonb) from (
        select cp.code, r.currency, count(*) as uses, sum(r.discount_minor) as discount
        from public.coupon_redemptions r join public.coupons cp on cp.id = r.coupon_id
        where r.created_at >= p_from and r.created_at < p_to group by cp.code, r.currency limit 50) x),
    'affiliates', jsonb_build_object(
        'clicks', (select count(*) from public.affiliate_clicks where created_at >= p_from and created_at < p_to),
        'orders', (select count(*) from paid where affiliate_id is not null),
        'revenue', case when money then (select coalesce(jsonb_object_agg(currency, t), '{}'::jsonb) from (select currency, sum(amount_minor) as t from paid where affiliate_id is not null group by currency) x) end,
        'commission', case when money then (select coalesce(jsonb_agg(x), '[]'::jsonb) from (select status, currency, sum(amount_minor) as amount from public.affiliate_commissions where created_at >= p_from and created_at < p_to group by status, currency) x) end),
    'email', (select jsonb_build_object('sent', count(*) filter (where status = 'sent'), 'failed', count(*) filter (where status = 'failed'),
        'delivered', count(delivered_at), 'opened', count(opened_at), 'clicked', count(clicked_at), 'bounced', count(bounced_at), 'unsubscribed', count(unsubscribed_at))
        from public.email_messages where kind <> 'test' and coalesce(sent_at, queued_at) >= p_from and coalesce(sent_at, queued_at) < p_to),
    'unsubscribes', (select count(*) from public.contacts where unsubscribed_at >= p_from and unsubscribed_at < p_to),
    'sources', (select coalesce(jsonb_agg(x order by x.orders desc), '[]'::jsonb) from (
        select coalesce(nullif(paid.attribution->'last'->>'source', ''), case when paid.affiliate_id is not null then 'affiliate' else 'direct' end) as source,
               paid.currency, count(*) as orders, case when money then sum(paid.amount_minor) end as revenue
        from paid group by 1, 2 limit 50) x),
    'first_sources', (select coalesce(jsonb_agg(x order by x.orders desc), '[]'::jsonb) from (
        select coalesce(nullif(paid.attribution->'first'->>'source', ''), 'direct') as source, count(*) as orders
        from paid group by 1 limit 50) x),
    'campaigns', (select coalesce(jsonb_agg(x order by x.orders desc), '[]'::jsonb) from (
        select mc.name, mc.slug,
               (select count(*) from paid where paid.attribution->'last'->>'campaign' = mc.slug or paid.attribution->'first'->>'campaign' = mc.slug
                  or paid.coupon_id in (select id from public.coupons where campaign_id = mc.id)) as orders,
               case when money then (select coalesce(jsonb_object_agg(currency, t), '{}'::jsonb) from (select currency, sum(amount_minor) as t from paid
                  where paid.attribution->'last'->>'campaign' = mc.slug or paid.attribution->'first'->>'campaign' = mc.slug
                     or paid.coupon_id in (select id from public.coupons where campaign_id = mc.id) group by currency) r) end as revenue,
               (select count(*) from public.email_messages m join public.email_campaigns ec on ec.id = m.campaign_id where ec.campaign_id = mc.id and m.status = 'sent') as emails_sent
        from public.marketing_campaigns mc where mc.status <> 'archived' limit 50) x)
  ) into res;
  return res;
end; $$;

-- ═════════════════════════ STORAGE ═════════════════════════
insert into storage.buckets (id, name, public) values ('product-files', 'product-files', false) on conflict (id) do nothing;
drop policy if exists "admin manage product files" on storage.objects;
create policy "admin manage product files" on storage.objects for all to authenticated
  using (bucket_id = 'product-files' and public.has_admin_permission('products'))
  with check (bucket_id = 'product-files' and public.has_admin_permission('products'));

-- ═════════════════════════ RLS ═════════════════════════
alter table public.marketing_campaigns   enable row level security;
alter table public.products              enable row level security;
alter table public.product_prices        enable row level security;
alter table public.product_files         enable row level security;
alter table public.bundle_items          enable row level security;
alter table public.related_products      enable row level security;
alter table public.entitlements          enable row level security;
alter table public.product_downloads     enable row level security;
alter table public.affiliates            enable row level security;
alter table public.affiliate_clicks      enable row level security;
alter table public.affiliate_commissions enable row level security;
alter table public.coupon_products       enable row level security;
alter table public.contacts              enable row level security;
alter table public.contact_tags          enable row level security;
alter table public.contact_notes         enable row level security;
alter table public.segments              enable row level security;
alter table public.email_campaigns       enable row level security;
alter table public.email_messages        enable row level security;
alter table public.automations           enable row level security;
alter table public.automation_runs       enable row level security;
alter table public.automation_logs       enable row level security;
alter table public.content_posts         enable row level security;
alter table public.whatsapp_messages     enable row level security;
alter table public.rate_events           enable row level security;  -- no policies: service role only

-- Admin read/write by permission.
do $$
declare r record;
begin
  for r in select * from (values
    ('marketing_campaigns','marketing_campaigns_admin','marketing'), ('products','products_admin','products'), ('product_prices','product_prices_admin','products'),
    ('product_files','product_files_admin','products'), ('bundle_items','bundle_items_admin','products'), ('related_products','related_products_admin','products'),
    ('coupon_products','coupon_products_admin','coupons'), ('contacts','contacts_admin','customers'), ('contact_tags','contact_tags_admin','customers'),
    ('contact_notes','contact_notes_admin','customers'), ('segments','segments_admin','marketing'), ('email_campaigns','email_campaigns_admin','marketing'),
    ('automations','automations_admin','marketing'), ('content_posts','content_posts_admin','marketing'), ('affiliates','affiliates_admin','affiliates'),
    ('affiliate_commissions','affiliate_commissions_admin','affiliates')
  ) as t(tbl, pol, perm) loop
    execute format('drop policy if exists %I on public.%I', r.pol, r.tbl);
    execute format('create policy %I on public.%I for all to authenticated using (public.has_admin_permission(%L)) with check (public.has_admin_permission(%L))', r.pol, r.tbl, r.perm, r.perm);
  end loop;
end $$;

-- Public catalogue: published products and their active prices, bundle contents and related links.
drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select to anon, authenticated using (status = 'published');
drop policy if exists product_prices_public_read on public.product_prices;
create policy product_prices_public_read on public.product_prices for select to anon, authenticated
  using (active and exists (select 1 from public.products p where p.id = product_id and p.status = 'published'));
drop policy if exists bundle_items_public_read on public.bundle_items;
create policy bundle_items_public_read on public.bundle_items for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = bundle_id and p.status = 'published'));
drop policy if exists related_products_public_read on public.related_products;
create policy related_products_public_read on public.related_products for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.status = 'published')
     and exists (select 1 from public.products p where p.id = related_id and p.status = 'published'));

-- Own rows.
drop policy if exists entitlements_read on public.entitlements;
create policy entitlements_read on public.entitlements for select to authenticated
  using (user_id = auth.uid() or public.has_admin_permission('customers') or public.has_admin_permission('payments'));
drop policy if exists product_downloads_read on public.product_downloads;
create policy product_downloads_read on public.product_downloads for select to authenticated
  using (user_id = auth.uid() or public.has_admin_permission('customers'));
drop policy if exists affiliates_own_read on public.affiliates;
create policy affiliates_own_read on public.affiliates for select to authenticated using (user_id = auth.uid());
drop policy if exists affiliate_commissions_own_read on public.affiliate_commissions;
create policy affiliate_commissions_own_read on public.affiliate_commissions for select to authenticated
  using (exists (select 1 from public.affiliates a where a.id = affiliate_id and a.user_id = auth.uid()));
drop policy if exists affiliate_clicks_admin_read on public.affiliate_clicks;
create policy affiliate_clicks_admin_read on public.affiliate_clicks for select to authenticated using (public.has_admin_permission('affiliates'));
drop policy if exists contacts_own_read on public.contacts;
create policy contacts_own_read on public.contacts for select to authenticated using (user_id = auth.uid());

-- Marketing staff see delivery data and logs (not personal CRM detail beyond the email address on a message).
drop policy if exists email_messages_admin_read on public.email_messages;
create policy email_messages_admin_read on public.email_messages for select to authenticated using (public.has_admin_permission('marketing'));
drop policy if exists automation_runs_admin_read on public.automation_runs;
create policy automation_runs_admin_read on public.automation_runs for select to authenticated using (public.has_admin_permission('marketing'));
drop policy if exists automation_logs_admin_read on public.automation_logs;
create policy automation_logs_admin_read on public.automation_logs for select to authenticated using (public.has_admin_permission('marketing'));
drop policy if exists whatsapp_messages_admin_read on public.whatsapp_messages;
create policy whatsapp_messages_admin_read on public.whatsapp_messages for select to authenticated using (public.has_admin_permission('marketing'));

-- Payments: affiliates staff may read payments referred by an affiliate (to review commissions).
drop policy if exists payments_select_own on public.payments;
create policy payments_select_own on public.payments for select to authenticated
  using (user_id = auth.uid() or public.has_admin_permission('payments') or (affiliate_id is not null and public.has_admin_permission('affiliates')));

-- ═════════════════════════ GRANTS ═════════════════════════
revoke all on public.marketing_campaigns, public.products, public.product_prices, public.product_files, public.bundle_items, public.related_products,
  public.entitlements, public.product_downloads, public.affiliates, public.affiliate_clicks, public.affiliate_commissions, public.coupon_products,
  public.contacts, public.contact_tags, public.contact_notes, public.segments, public.email_campaigns, public.email_messages, public.automations,
  public.automation_runs, public.automation_logs, public.content_posts, public.whatsapp_messages, public.rate_events from anon, authenticated;
revoke all on public.customer_overview from anon, authenticated;

grant select on public.products, public.product_prices, public.bundle_items, public.related_products to anon, authenticated;
grant select, insert, update, delete on public.marketing_campaigns, public.products, public.product_prices, public.product_files, public.bundle_items,
  public.related_products, public.coupon_products, public.contacts, public.contact_tags, public.contact_notes, public.segments, public.email_campaigns,
  public.automations, public.content_posts, public.affiliates, public.affiliate_commissions to authenticated;
grant select on public.entitlements, public.product_downloads, public.affiliate_clicks, public.email_messages, public.automation_runs,
  public.automation_logs, public.whatsapp_messages, public.customer_overview to authenticated;
grant all on public.marketing_campaigns, public.products, public.product_prices, public.product_files, public.bundle_items, public.related_products,
  public.entitlements, public.product_downloads, public.affiliates, public.affiliate_clicks, public.affiliate_commissions, public.coupon_products,
  public.contacts, public.contact_tags, public.contact_notes, public.segments, public.email_campaigns, public.email_messages, public.automations,
  public.automation_runs, public.automation_logs, public.content_posts, public.whatsapp_messages, public.rate_events, public.customer_overview to service_role;
grant usage, select on all sequences in schema public to service_role;

-- Functions: browser-callable only where they check the caller themselves.
revoke all on function public.product_price(uuid, text), public.user_owns_product(uuid, uuid), public.coupon_evaluate(text, uuid, text, integer, uuid, uuid),
  public.resolve_affiliate(text, uuid), public.grant_course_access(uuid, uuid, text), public.grant_product(uuid, uuid, uuid, text),
  public.record_commission(uuid), public.enqueue_automations(text, uuid, text), public.contact_for_user(uuid),
  public.unsubscribe_by_token(text, uuid), public.claim_email_messages(integer), public.finish_email_campaigns(),
  public.record_email_event(text, text, timestamptz), public.claim_automation_runs(integer), public.flag_abandoned_checkouts(interval),
  public.check_bundle_item(), public.sync_contact_from_profile(), public.trg_entitlement_events(), public.trg_enrolment_events(), public.trg_redemption_events()
  from public, anon, authenticated;
grant execute on function public.product_price(uuid, text), public.user_owns_product(uuid, uuid), public.coupon_evaluate(text, uuid, text, integer, uuid, uuid),
  public.resolve_affiliate(text, uuid), public.grant_course_access(uuid, uuid, text), public.grant_product(uuid, uuid, uuid, text),
  public.record_commission(uuid), public.enqueue_automations(text, uuid, text), public.contact_for_user(uuid),
  public.unsubscribe_by_token(text, uuid), public.claim_email_messages(integer), public.finish_email_campaigns(),
  public.record_email_event(text, text, timestamptz), public.claim_automation_runs(integer), public.flag_abandoned_checkouts(interval) to service_role;

revoke all on function public.product_checkout_quote(uuid, text, text), public.create_product_checkout(uuid, text, text, text, jsonb),
  public.attach_checkout_attribution(text, text, jsonb), public.can_access_product(uuid), public.prepare_product_download(uuid),
  public.admin_grant_product(uuid, uuid), public.admin_revoke_entitlement(uuid), public.contact_lifecycle(uuid), public.segment_contacts(jsonb),
  public.segment_count(jsonb), public.set_my_marketing_consent(boolean), public.start_email_campaign(uuid), public.apply_affiliate(text, text),
  public.update_my_affiliate_payout(text), public.my_affiliate_summary(), public.marketing_stats(timestamptz, timestamptz) from public, anon;
grant execute on function public.product_checkout_quote(uuid, text, text), public.create_product_checkout(uuid, text, text, text, jsonb),
  public.attach_checkout_attribution(text, text, jsonb), public.can_access_product(uuid), public.prepare_product_download(uuid),
  public.admin_grant_product(uuid, uuid), public.admin_revoke_entitlement(uuid), public.contact_lifecycle(uuid), public.segment_contacts(jsonb),
  public.segment_count(jsonb), public.set_my_marketing_consent(boolean), public.start_email_campaign(uuid), public.apply_affiliate(text, text),
  public.update_my_affiliate_payout(text), public.my_affiliate_summary(), public.marketing_stats(timestamptz, timestamptz) to authenticated, service_role;

-- Referral clicks come from the edge middleware with the public key (the function validates and rate-limits).
revoke all on function public.record_affiliate_click(text, text, text) from public;
grant execute on function public.record_affiliate_click(text, text, text) to anon, authenticated, service_role;
grant execute on function public.clean_touch(jsonb), public.clean_attribution(jsonb) to anon, authenticated, service_role;
