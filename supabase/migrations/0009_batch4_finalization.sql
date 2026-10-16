-- 0009: Batch 4 (finalization). Payment providers + methods, contact inbox with replies, notifications, security and
-- webhook logs, shop settings and richer product details.
-- Run AFTER 0001–0008. IDEMPOTENT and NON-DESTRUCTIVE: only adds tables/columns/functions; existing rows are kept.
-- Secrets are never stored here: provider keys stay in server environment variables.

-- ═════════════════════════ PAYMENT PROVIDERS ═════════════════════════
alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check check (provider in ('paystack','flutterwave','palmpay','free','manual'));
alter table public.payments add column if not exists payment_method text check (payment_method is null or payment_method ~ '^[a-z_]{2,30}$');

-- Which providers checkout may use, in what order, for which currencies and methods. Configuration only (no keys).
create table if not exists public.payment_providers (
  id text primary key check (id in ('paystack','flutterwave','palmpay')),
  enabled boolean not null default false,
  priority integer not null default 100 check (priority between 0 and 1000),
  currencies text[] not null default '{}',
  methods text[] not null default '{}',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint payment_providers_currencies check (currencies <@ array['NGN','USD','GBP','EUR','GHS','KES','ZAR']::text[]),
  constraint payment_providers_methods check (methods <@ array['card','bank','bank_transfer','ussd','qr','mobile_money','opay','apple_pay']::text[])
);
-- Paystack keeps working exactly as before (enabled, NGN, its usual methods). Flutterwave and PalmPay start disabled.
insert into public.payment_providers (id, enabled, priority, currencies, methods) values
  ('paystack', true, 10, '{NGN}', '{card,bank,bank_transfer,ussd,qr}'),
  ('flutterwave', false, 20, '{NGN}', '{card,bank_transfer,ussd,opay,qr}'),
  ('palmpay', false, 30, '{}', '{}')
on conflict (id) do nothing;

-- The checkout action calls this right after create_checkout / create_product_checkout to record which provider and
-- method the buyer chose. Only for the caller's own PENDING payment, and only an enabled provider.
create or replace function public.set_payment_provider(p_reference text, p_provider text, p_method text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if not exists (select 1 from public.payment_providers where id = p_provider and enabled) then return false; end if;
  if p_method is not null and p_method !~ '^[a-z_]{2,30}$' then return false; end if;
  update public.payments set provider = p_provider, payment_method = p_method
  where reference = p_reference and user_id = auth.uid() and status = 'pending' and provider in ('paystack','flutterwave','palmpay');
  return found;
end; $$;

-- ═════════════════════════ WEBHOOK + SECURITY LOGS ═════════════════════════
-- Every webhook delivery (accepted or rejected). No payloads, no secrets: provider, event name, outcome, reference.
create table if not exists public.webhook_events (
  id bigint generated always as identity primary key,
  provider text not null check (provider ~ '^[a-z_]{2,30}$'),
  event text check (event is null or char_length(event) <= 80),
  outcome text not null check (outcome in ('processed','ignored','rejected','failed')),
  reference text check (reference is null or char_length(reference) <= 100),
  received_at timestamptz not null default now()
);
create index if not exists webhook_events_idx on public.webhook_events (provider, received_at desc);

-- Sign-ins, failed sign-ins, password events, step-up checks, rejected webhooks. Identities are hashed, never stored raw.
create table if not exists public.security_events (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('login_success','login_failed','signup','password_reset_requested','password_changed','admin_stepup_success','admin_stepup_failed','webhook_rejected','rate_limited')),
  user_id uuid references auth.users(id) on delete set null,
  email_hash text check (email_hash is null or email_hash ~ '^[a-f0-9]{64}$'),
  email_hint text check (email_hint is null or char_length(email_hint) <= 80),  -- masked, e.g. "sa•••@gmail.com"
  ip_hash text check (ip_hash is null or ip_hash ~ '^[a-f0-9]{64}$'),
  detail text check (detail is null or char_length(detail) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists security_events_idx on public.security_events (kind, created_at desc);
create index if not exists security_events_user_idx on public.security_events (user_id, created_at desc);

-- Active sessions (Supabase keeps them in auth.sessions). Masked, admins only. Empty if the auth schema differs.
create or replace function public.admin_active_sessions() returns table (user_hint text, is_admin boolean, sessions bigint, last_seen timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.has_admin_permission('admins') then raise exception 'not authorised'; end if;
  return query execute $q$
    select regexp_replace(u.email, '^(.{2})[^@]*', '\1•••') as user_hint,
           exists (select 1 from public.admin_users a where a.user_id = u.id) as is_admin,
           count(s.id) as sessions,
           max(coalesce(s.refreshed_at, s.updated_at, s.created_at)) as last_seen
    from auth.sessions s join auth.users u on u.id = s.user_id
    where coalesce(s.not_after, now() + interval '1 day') > now()
    group by u.id, u.email
    order by max(coalesce(s.refreshed_at, s.updated_at, s.created_at)) desc nulls last
    limit 50 $q$;
exception when undefined_table or undefined_column then
  return;
end; $$;

-- ═════════════════════════ CONTACT INBOX ═════════════════════════
alter table public.contact_messages
  add column if not exists subject text check (subject is null or char_length(subject) <= 160),
  add column if not exists replied_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists notify_status text check (notify_status is null or notify_status in ('sent','failed','not_configured')),
  add column if not exists notify_message_id text,
  add column if not exists updated_at timestamptz not null default now();
alter table public.contact_messages drop constraint if exists contact_messages_status_check;
alter table public.contact_messages add constraint contact_messages_status_check check (status in ('new','read','replied','archived'));
create index if not exists contact_messages_email_idx on public.contact_messages (lower(email), created_at desc);
drop trigger if exists trg_contact_messages_updated on public.contact_messages;
create trigger trg_contact_messages_updated before update on public.contact_messages for each row execute function public.set_updated_at();

-- Replies sent from Admin → Messages (and, in future, inbound replies from a mailbox integration).
create table if not exists public.message_replies (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.contact_messages(id) on delete cascade,
  direction text not null default 'outbound' check (direction in ('outbound','inbound')),
  body text not null check (char_length(body) between 1 and 10000),
  subject text check (subject is null or char_length(subject) <= 200),
  to_email text not null,
  bcc_email text,
  sent_by uuid references auth.users(id) on delete set null,
  status text not null default 'sent' check (status in ('sent','failed')),
  provider text,
  provider_message_id text,
  error text check (error is null or char_length(error) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists message_replies_message_idx on public.message_replies (message_id, created_at);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'message_replies_sender_profile_fk') then
    alter table public.message_replies add constraint message_replies_sender_profile_fk foreign key (sent_by) references public.profiles(id) on delete set null;
  end if;
end $$;

-- Public form with a subject (the 4-argument version from 0003 keeps working).
create or replace function public.submit_contact_message(p_name text, p_email text, p_subject text, p_service text, p_message text) returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid; recent int;
begin
  if length(trim(coalesce(p_name,''))) < 2 or length(p_name) > 120 then raise exception 'invalid name'; end if;
  if coalesce(p_email,'') !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(p_email) > 200 then raise exception 'invalid email'; end if;
  if length(coalesce(p_subject,'')) > 160 then raise exception 'invalid subject'; end if;
  if length(trim(coalesce(p_message,''))) < 10 or length(p_message) > 5000 then raise exception 'invalid message'; end if;
  select count(*) into recent from public.contact_messages where lower(email) = lower(trim(p_email)) and created_at > now() - interval '1 hour';
  if recent >= 5 then raise exception 'too many messages'; end if;
  insert into public.contact_messages (name, email, subject, service, message)
  values (trim(p_name), lower(trim(p_email)), nullif(left(trim(coalesce(p_subject,'')), 160), ''), nullif(left(trim(coalesce(p_service,'')), 120), ''), trim(p_message))
  returning id into new_id;
  return new_id;
end; $$;
revoke all on function public.submit_contact_message(text, text, text, text, text) from public;
grant execute on function public.submit_contact_message(text, text, text, text, text) to anon, authenticated;

-- ═════════════════════════ NOTIFICATIONS ═════════════════════════
-- user_id set = for that person. user_id null = for admins holding `permission`.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  permission text check (permission is null or permission ~ '^[a-z_]{3,20}$'),
  kind text not null check (kind in ('purchase','payment_failed','new_student','message','certificate','ai_completed','affiliate')),
  title text not null check (char_length(title) <= 160),
  body text check (body is null or char_length(body) <= 300),
  link text check (link is null or (link ~ '^/' and link !~ '^//')),
  created_at timestamptz not null default now(),
  constraint notifications_audience check (user_id is not null or permission is not null)
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_admin_idx on public.notifications (permission, created_at desc) where user_id is null;

create table if not exists public.notification_reads (
  notification_id uuid not null references public.notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

-- Internal: never raises (a notification must never block a payment, sign-up or message).
create or replace function public.notify(p_user uuid, p_perm text, p_kind text, p_title text, p_body text, p_link text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.notifications (user_id, permission, kind, title, body, link)
  values (p_user, p_perm, p_kind, left(p_title, 160), left(p_body, 300), p_link);
exception when others then null;
end; $$;

create or replace function public.trg_notify_payment() returns trigger
language plpgsql security definer set search_path = public as $$
declare item text;
begin
  select coalesce((select name from public.products where id = new.product_id), (select title from public.courses where id = new.course_id), 'a purchase') into item;
  if new.status = 'successful' and old.status is distinct from 'successful' then
    perform public.notify(null, 'payments', 'purchase', 'New purchase: ' || item,
      case when new.amount_minor = 0 then 'Free checkout' else new.currency || ' ' || to_char(new.amount_minor / 100.0, 'FM999,999,999,990.00') end, '/admin/payments');
  elsif new.status = 'failed' and old.status = 'pending' and coalesce(new.failure_reason, '') not in ('not_started', 'abandoned') then
    perform public.notify(null, 'payments', 'payment_failed', 'Payment failed: ' || item, coalesce(new.failure_reason, 'failed') || ' · ' || new.reference, '/admin/payments');
  end if;
  return new;
end; $$;
drop trigger if exists trg_payments_notify on public.payments;
create trigger trg_payments_notify after update of status on public.payments for each row execute function public.trg_notify_payment();

create or replace function public.trg_notify_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(null, 'students', 'new_student', 'New account: ' || coalesce(nullif(trim(new.first_name || ' ' || new.last_name), ''), 'someone signed up'), null, '/admin/students');
  return new;
end; $$;
drop trigger if exists trg_profiles_notify on public.profiles;
create trigger trg_profiles_notify after insert on public.profiles for each row execute function public.trg_notify_profile();

create or replace function public.trg_notify_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.notify(null, 'website', 'message', 'New message from ' || new.name, left(coalesce(new.subject, new.message), 120), '/admin/website/messages/' || new.id);
  return new;
end; $$;
drop trigger if exists trg_contact_messages_notify on public.contact_messages;
create trigger trg_contact_messages_notify after insert on public.contact_messages for each row execute function public.trg_notify_message();

create or replace function public.trg_notify_certificate() returns trigger
language plpgsql security definer set search_path = public as $$
declare t text;
begin
  select title into t from public.courses where id = new.course_id;
  perform public.notify(new.user_id, null, 'certificate', 'Your certificate is ready', coalesce(t, 'Course') || ' · ' || new.certificate_number, '/dashboard');
  perform public.notify(null, 'certificates', 'certificate', 'Certificate issued: ' || coalesce(t, 'course'), new.certificate_number, '/admin/certificates');
  return new;
end; $$;
drop trigger if exists trg_certificates_notify on public.certificates;
create trigger trg_certificates_notify after insert on public.certificates for each row execute function public.trg_notify_certificate();

create or replace function public.trg_notify_ai() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.created_by is not null and new.status = 'succeeded' and new.kind in ('quiz','regenerate','content','lesson_assistant','marketing') then
    perform public.notify(new.created_by, null, 'ai_completed', 'AI ' || replace(new.kind, '_', ' ') || ' finished', coalesce(new.output_count, 0) || ' result(s) · ' || new.model,
      case new.kind when 'quiz' then '/admin/ai/quiz-generator' when 'marketing' then '/admin/marketing/assistant' else '/admin/ai' end);
  end if;
  return new;
end; $$;
drop trigger if exists trg_ai_notify on public.ai_generations;
create trigger trg_ai_notify after insert on public.ai_generations for each row execute function public.trg_notify_ai();

create or replace function public.trg_notify_affiliate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'affiliates' then
    perform public.notify(null, 'affiliates', 'affiliate', 'Affiliate application: ' || new.code, null, '/admin/marketing/affiliates/' || new.id);
  else
    perform public.notify(null, 'affiliates', 'affiliate', 'Affiliate sale', new.currency || ' ' || to_char(new.amount_minor / 100.0, 'FM999,999,990.00') || ' commission pending', '/admin/marketing/affiliates/' || new.affiliate_id);
  end if;
  return new;
end; $$;
drop trigger if exists trg_affiliates_notify on public.affiliates;
create trigger trg_affiliates_notify after insert on public.affiliates for each row execute function public.trg_notify_affiliate();
drop trigger if exists trg_commissions_notify on public.affiliate_commissions;
create trigger trg_commissions_notify after insert on public.affiliate_commissions for each row execute function public.trg_notify_affiliate();

-- Notifications visible to the caller (own + admin ones for their permissions), newest first, with read state.
create or replace function public.my_notifications(p_limit integer default 30) returns table (id uuid, kind text, title text, body text, link text, created_at timestamptz, is_read boolean)
language sql stable security definer set search_path = public as $$
  select n.id, n.kind, n.title, n.body, n.link, n.created_at, exists (select 1 from public.notification_reads r where r.notification_id = n.id and r.user_id = auth.uid())
  from public.notifications n
  where auth.uid() is not null and (n.user_id = auth.uid() or (n.user_id is null and public.has_admin_permission(n.permission)))
  order by n.created_at desc limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;
create or replace function public.mark_notifications_read(p_ids uuid[] default null) returns integer
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then return 0; end if;
  insert into public.notification_reads (notification_id, user_id)
  select x.id, auth.uid() from public.notifications x
  where (p_ids is null or x.id = any (p_ids))
    and (x.user_id = auth.uid() or (x.user_id is null and public.has_admin_permission(x.permission)))
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end; $$;

-- ═════════════════════════ SHOP CONTROL ═════════════════════════
create table if not exists public.shop_settings (
  id boolean primary key default true check (id),
  title text not null default 'Shop' check (char_length(title) between 1 and 80),
  intro text check (intro is null or char_length(intro) <= 600),
  seo_title text check (seo_title is null or char_length(seo_title) <= 80),
  seo_description text check (seo_description is null or char_length(seo_description) <= 200),
  empty_title text check (empty_title is null or char_length(empty_title) <= 120),
  empty_body text check (empty_body is null or char_length(empty_body) <= 400),
  show_newsletter boolean not null default true,
  newsletter_title text check (newsletter_title is null or char_length(newsletter_title) <= 120),
  newsletter_body text check (newsletter_body is null or char_length(newsletter_body) <= 300),
  updated_at timestamptz not null default now()
);
-- The copy the shop already shows today, so nothing changes until it's edited.
insert into public.shop_settings (id, title, intro, empty_title, empty_body) values
  (true, 'Shop', 'Ebooks, guides, templates and courses. Everything you buy stays in your library.',
   'Nothing here yet', 'The first guides and ebooks are being prepared. Leave your email below and we''ll tell you when they''re ready.')
on conflict (id) do nothing;
drop trigger if exists trg_shop_settings_updated on public.shop_settings;
create trigger trg_shop_settings_updated before update on public.shop_settings for each row execute function public.set_updated_at();

alter table public.products
  add column if not exists display_order integer not null default 0,
  add column if not exists featured boolean not null default false,
  add column if not exists badge text check (badge is null or char_length(badge) <= 30),
  add column if not exists features jsonb not null default '[]'::jsonb check (jsonb_typeof(features) = 'array' and jsonb_array_length(features) <= 20),
  add column if not exists faq jsonb not null default '[]'::jsonb check (jsonb_typeof(faq) = 'array' and jsonb_array_length(faq) <= 12),
  add column if not exists details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object');
create index if not exists products_shop_order_idx on public.products (featured desc, display_order, published_at desc) where status = 'published';

-- ═════════════════════════ RLS + GRANTS ═════════════════════════
alter table public.payment_providers  enable row level security;
alter table public.webhook_events     enable row level security;
alter table public.security_events    enable row level security;
alter table public.message_replies    enable row level security;
alter table public.notifications      enable row level security;
alter table public.notification_reads enable row level security;
alter table public.shop_settings      enable row level security;

drop policy if exists payment_providers_read on public.payment_providers;
create policy payment_providers_read on public.payment_providers for select to anon, authenticated using (true);   -- no secrets in this table
drop policy if exists payment_providers_admin on public.payment_providers;
create policy payment_providers_admin on public.payment_providers for update to authenticated using (public.has_admin_permission('payments')) with check (public.has_admin_permission('payments'));
drop policy if exists webhook_events_admin_read on public.webhook_events;
create policy webhook_events_admin_read on public.webhook_events for select to authenticated using (public.has_admin_permission('payments') or public.has_admin_permission('activity'));
drop policy if exists security_events_admin_read on public.security_events;
create policy security_events_admin_read on public.security_events for select to authenticated using (public.has_admin_permission('activity'));
drop policy if exists message_replies_admin on public.message_replies;
create policy message_replies_admin on public.message_replies for select to authenticated using (public.has_admin_permission('website'));
drop policy if exists notifications_read on public.notifications;
create policy notifications_read on public.notifications for select to authenticated
  using (user_id = auth.uid() or (user_id is null and public.has_admin_permission(permission)));
drop policy if exists notification_reads_own on public.notification_reads;
create policy notification_reads_own on public.notification_reads for select to authenticated using (user_id = auth.uid());
drop policy if exists shop_settings_read on public.shop_settings;
create policy shop_settings_read on public.shop_settings for select to anon, authenticated using (true);
drop policy if exists shop_settings_admin on public.shop_settings;
create policy shop_settings_admin on public.shop_settings for update to authenticated using (public.has_admin_permission('products')) with check (public.has_admin_permission('products'));

revoke all on public.payment_providers, public.webhook_events, public.security_events, public.message_replies, public.notifications,
  public.notification_reads, public.shop_settings from anon, authenticated;
grant select on public.payment_providers, public.shop_settings to anon, authenticated;
grant update on public.payment_providers, public.shop_settings to authenticated;
grant select on public.webhook_events, public.security_events, public.message_replies, public.notifications, public.notification_reads to authenticated;
grant all on public.payment_providers, public.webhook_events, public.security_events, public.message_replies, public.notifications,
  public.notification_reads, public.shop_settings to service_role;
grant usage, select on all sequences in schema public to service_role;

revoke all on function public.notify(uuid, text, text, text, text, text), public.trg_notify_payment(), public.trg_notify_profile(),
  public.trg_notify_message(), public.trg_notify_certificate(), public.trg_notify_ai(), public.trg_notify_affiliate() from public, anon, authenticated;
revoke all on function public.set_payment_provider(text, text, text), public.my_notifications(integer), public.mark_notifications_read(uuid[]),
  public.admin_active_sessions() from public, anon;
grant execute on function public.set_payment_provider(text, text, text), public.my_notifications(integer), public.mark_notifications_read(uuid[]),
  public.admin_active_sessions() to authenticated;
