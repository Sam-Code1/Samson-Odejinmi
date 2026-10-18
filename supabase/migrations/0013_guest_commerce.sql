-- 0013: Guest checkout, carts, orders, secure guest delivery and account claim.
-- Requires 0008–0012. Idempotent and non-destructive: no table is dropped, no row deleted; existing checkouts,
-- payments, enrolments, entitlements, coupons and refunds keep working exactly as before.
--
-- ONE order system: `payments` stays the order (reference, amount, currency, status, provider) and gains an order
-- number, guest email, customer name, tax and line items (`payment_items`), so a cart of several products is one order
-- and one payment. Guests (no account) own purchases through entitlements tied to the order + their email; a secure,
-- hashed, expiring access token (order_access_tokens) lets them download and later claim the order into an account.
--
-- Everything that creates orders, fulfils them, issues downloads or claims purchases is SERVER-ONLY (service role):
-- the server action validates the request, then the database prices, checks and records it. Browsers never call these.

do $$
begin
  if to_regclass('public.products') is null or to_regclass('public.shop_settings') is null or to_regclass('public.payment_provider_capabilities') is null then
    raise exception 'Run 0008 to 0012 first, then this file.';
  end if;
end $$;

-- ═════════════════════════ ORDERS (payments) ═════════════════════════
create sequence if not exists public.order_number_seq;
alter table public.payments
  add column if not exists order_number text,
  add column if not exists guest_email text,
  add column if not exists customer_name text,
  add column if not exists tax_minor integer not null default 0;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payments_guest_email_check') then
    alter table public.payments add constraint payments_guest_email_check
      check (guest_email is null or (guest_email = lower(guest_email) and guest_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(guest_email) <= 254));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_customer_name_check') then
    alter table public.payments add constraint payments_customer_name_check check (customer_name is null or char_length(customer_name) <= 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payments_tax_check') then
    alter table public.payments add constraint payments_tax_check check (tax_minor >= 0);
  end if;
end $$;
-- Human-friendly order number (FOLA-2026-000123). Display only: NEVER an authorization token.
create or replace function public.trg_order_number() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.order_number is null then
    new.order_number := 'FOLA-' || to_char(coalesce(new.created_at, now()), 'YYYY') || '-' || lpad(nextval('public.order_number_seq')::text, 6, '0');
  end if;
  return new;
end; $$;
drop trigger if exists trg_payments_order_number on public.payments;
create trigger trg_payments_order_number before insert on public.payments for each row execute function public.trg_order_number();
-- Existing payments get numbers too (oldest first). Only fills NULLs.
do $$
declare r record;
begin
  for r in select id, created_at from public.payments where order_number is null order by created_at, id loop
    update public.payments set order_number = 'FOLA-' || to_char(r.created_at, 'YYYY') || '-' || lpad(nextval('public.order_number_seq')::text, 6, '0') where id = r.id;
  end loop;
end $$;
create unique index if not exists payments_order_number_key on public.payments (order_number);
create index if not exists payments_guest_email_idx on public.payments (guest_email, created_at desc) where guest_email is not null;

-- Line items: what an order contains, priced by the database at checkout (snapshot of name and unit price).
create table if not exists public.payment_items (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,
  name text not null check (char_length(name) between 1 and 200),
  unit_minor integer not null check (unit_minor >= 0),
  created_at timestamptz not null default now(),
  constraint payment_items_one_target check (num_nonnulls(product_id, course_id) <= 1)
);
create index if not exists payment_items_payment_idx on public.payment_items (payment_id);
create index if not exists payment_items_product_idx on public.payment_items (product_id) where product_id is not null;

-- ═════════════════════════ GUEST OWNERSHIP ═════════════════════════
alter table public.entitlements alter column user_id drop not null;
alter table public.entitlements add column if not exists guest_email text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'entitlements_owner_check') then
    alter table public.entitlements add constraint entitlements_owner_check check (user_id is not null or guest_email is not null);
  end if;
  -- 'merged': a guest copy superseded when the buyer claimed the order into an account that already owned the product.
  alter table public.entitlements drop constraint if exists entitlements_status_check;
  alter table public.entitlements add constraint entitlements_status_check check (status in ('active','revoked','refunded','merged'));
end $$;
create unique index if not exists entitlements_guest_payment_product_key on public.entitlements (payment_id, product_id) where user_id is null;
create index if not exists entitlements_guest_email_idx on public.entitlements (guest_email) where user_id is null;

alter table public.product_downloads alter column user_id drop not null;
alter table public.product_downloads add column if not exists payment_id uuid references public.payments(id) on delete set null;
create index if not exists product_downloads_payment_idx on public.product_downloads (payment_id, created_at desc) where payment_id is not null;

-- Hashed access tokens for an order (receipt, downloads, review, claim). The raw token exists only in the buyer's
-- browser cookie / email link; only its SHA-256 is stored. Expiring and revocable. No browser access at all.
create table if not exists public.order_access_tokens (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  channel text not null check (channel in ('browser','email','regenerated')),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists order_access_tokens_payment_idx on public.order_access_tokens (payment_id);

-- ═════════════════════════ COMMERCE SETTINGS (one place: shop_settings) ═════════════════════════
alter table public.shop_settings
  add column if not exists guest_checkout_enabled boolean not null default true,
  add column if not exists downloads_enabled boolean not null default true,
  add column if not exists reviews_enabled boolean not null default true,
  add column if not exists guest_reviews_enabled boolean not null default true;

-- ═════════════════════════ COMMERCE EVENTS (analytics foundation, no personal data) ═════════════════════════
create table if not exists public.commerce_events (
  id bigint generated always as identity primary key,
  event text not null check (event in ('add_to_cart','checkout_started','payment_started','purchase_completed','download','account_claimed','review_submitted','currency_selected')),
  product_id uuid references public.products(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),
  provider text check (provider is null or provider ~ '^[a-z_]{2,30}$'),
  guest boolean,
  created_at timestamptz not null default now()
);
create index if not exists commerce_events_event_idx on public.commerce_events (event, created_at desc);

-- ═════════════════════════ PRICING (database decides; browser sends only ids, currency, coupon) ═════════════════════════
-- p_items: [{"kind":"product"|"course","id":"<uuid>"}, …] (max 20, duplicates ignored). One of each item: digital
-- products and courses are bought once. Returns priced lines, subtotal, discount, tax (0 until configured), total.
create or replace function public.order_quote(p_items jsonb, p_currency text, p_code text, p_user uuid, p_email text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  cur text := upper(coalesce(p_currency, ''));
  em text := lower(trim(coalesce(p_email, '')));
  it jsonb; kind text; iid uuid; key text; seen text[] := '{}';
  pr record; c record; price int; subtotal int := 0; lines jsonb := '[]'::jsonb; v_course uuid;
  cp record; applicable int := 0; disc int := 0; used int; used_me int; li jsonb; v_cid uuid; v_code text;
begin
  if cur !~ '^[A-Z]{3}$' then return jsonb_build_object('ok', false, 'error', 'no_price'); end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then return jsonb_build_object('ok', false, 'error', 'empty'); end if;
  if jsonb_array_length(p_items) > 20 then return jsonb_build_object('ok', false, 'error', 'too_many_items'); end if;

  for it in select value from jsonb_array_elements(p_items) loop
    kind := it->>'kind';
    begin iid := (it->>'id')::uuid; exception when others then return jsonb_build_object('ok', false, 'error', 'not_available'); end;
    key := coalesce(kind, '') || ':' || iid::text;
    continue when key = any(seen);
    seen := seen || key;
    if kind = 'product' then
      select * into pr from public.products where id = iid;
      if not found or pr.status <> 'published' then return jsonb_build_object('ok', false, 'error', 'not_available'); end if;
      price := public.product_price(iid, cur);
      if price is null then return jsonb_build_object('ok', false, 'error', 'no_price', 'item', pr.name); end if;
      v_course := case when pr.product_type = 'course' then pr.course_id end;
      if p_user is not null and public.user_owns_product(p_user, iid) then return jsonb_build_object('ok', false, 'error', 'already_owned', 'item', pr.name); end if;
      if p_user is null and em <> '' and exists (select 1 from public.entitlements e where e.user_id is null and e.guest_email = em and e.product_id = iid and e.status = 'active') then
        return jsonb_build_object('ok', false, 'error', 'already_owned_email', 'item', pr.name);
      end if;
      lines := lines || jsonb_build_object('kind', 'product', 'id', iid, 'name', pr.name, 'product_type', pr.product_type, 'course_id', v_course, 'unit', price);
    elsif kind = 'course' then
      select id, title, status into c from public.courses where id = iid;
      if not found or c.status <> 'published' then return jsonb_build_object('ok', false, 'error', 'not_available'); end if;
      select amount_minor into price from public.course_pricing where course_id = iid and currency = cur and active;
      if price is null then return jsonb_build_object('ok', false, 'error', 'no_price', 'item', c.title); end if;
      if p_user is not null and exists (select 1 from public.enrolments where user_id = p_user and course_id = iid and status in ('active','completed')) then
        return jsonb_build_object('ok', false, 'error', 'already_enrolled', 'item', c.title);
      end if;
      lines := lines || jsonb_build_object('kind', 'course', 'id', iid, 'name', c.title, 'product_type', 'course', 'course_id', iid, 'unit', price);
    else
      return jsonb_build_object('ok', false, 'error', 'not_available');
    end if;
    subtotal := subtotal + price;
  end loop;

  if nullif(trim(coalesce(p_code, '')), '') is not null then
    select * into cp from public.coupons where code = upper(trim(p_code));
    if not found or not cp.active then return jsonb_build_object('ok', false, 'error', 'coupon_invalid'); end if;
    if cp.starts_at is not null and cp.starts_at > now() then return jsonb_build_object('ok', false, 'error', 'coupon_not_started'); end if;
    if cp.expires_at is not null and cp.expires_at <= now() then return jsonb_build_object('ok', false, 'error', 'coupon_expired'); end if;
    -- A fixed amount is in ONE currency: ₦1,000 off never becomes $1,000 off.
    if cp.currency is not null and cp.currency <> cur then return jsonb_build_object('ok', false, 'error', 'coupon_currency', 'coupon_currency', cp.currency); end if;
    for li in select value from jsonb_array_elements(lines) loop
      if cp.applies_to_all
         or (li->>'kind' = 'product' and exists (select 1 from public.coupon_products where coupon_id = cp.id and product_id = (li->>'id')::uuid))
         or (li->>'course_id' is not null and exists (select 1 from public.coupon_courses where coupon_id = cp.id and course_id = (li->>'course_id')::uuid)) then
        applicable := applicable + (li->>'unit')::int;
      end if;
    end loop;
    if applicable = 0 then return jsonb_build_object('ok', false, 'error', 'coupon_not_applicable'); end if;
    if cp.min_amount_minor is not null and applicable < cp.min_amount_minor then return jsonb_build_object('ok', false, 'error', 'coupon_minimum'); end if;
    select count(*) into used from public.coupon_redemptions where coupon_id = cp.id;
    if cp.usage_limit is not null and used >= cp.usage_limit then return jsonb_build_object('ok', false, 'error', 'coupon_used_up'); end if;
    if p_user is not null then
      select count(*) into used_me from public.coupon_redemptions where coupon_id = cp.id and user_id = p_user;
    elsif em <> '' then
      select count(*) into used_me from public.coupon_redemptions r join public.payments pay on pay.id = r.payment_id where r.coupon_id = cp.id and pay.guest_email = em;
    else used_me := 0;
    end if;
    if cp.per_user_limit is not null and used_me >= cp.per_user_limit then return jsonb_build_object('ok', false, 'error', 'coupon_already_used'); end if;
    disc := case when cp.discount_type = 'percentage' then floor(applicable::numeric * cp.discount_value / 100)::int else least(cp.discount_value, applicable) end;
    disc := greatest(least(disc, subtotal), 0);
    v_cid := cp.id; v_code := cp.code;
  end if;

  return jsonb_build_object('ok', true, 'currency', cur, 'items', lines, 'subtotal', subtotal, 'discount', disc, 'tax', 0,
    'total', greatest(subtotal - disc, 0), 'coupon_id', v_cid, 'coupon_code', v_code);
end; $$;

-- Grants a product to a guest (email + order). Bundles grant their items too. Idempotent per order + product.
create or replace function public.grant_product_guest(p_email text, p_product uuid, p_payment uuid, p_source text) returns void
language plpgsql security definer set search_path = public as $$
declare pr record; it record;
begin
  select * into pr from public.products where id = p_product;
  if not found or p_email is null or p_payment is null then return; end if;
  insert into public.entitlements (user_id, guest_email, product_id, status, source, payment_id)
  values (null, p_email, pr.id, 'active', p_source, p_payment)
  on conflict (payment_id, product_id) where user_id is null do nothing;
  if pr.product_type = 'bundle' then
    for it in select p.id from public.bundle_items b join public.products p on p.id = b.product_id where b.bundle_id = pr.id order by b.position loop
      insert into public.entitlements (user_id, guest_email, product_id, status, source, payment_id, via_product_id)
      values (null, p_email, it.id, 'active', 'bundle', p_payment, pr.id)
      on conflict (payment_id, product_id) where user_id is null do nothing;
    end loop;
  end if;
end; $$;

-- Grants everything in an order: to the account when there is one, otherwise to the guest email.
create or replace function public.grant_order_items(p_payment uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p record; li record; src text;
begin
  select * into p from public.payments where id = p_payment;
  if not found then return; end if;
  src := case when p.amount_minor = 0 then 'free' else 'purchase' end;
  for li in select * from public.payment_items where payment_id = p.id loop
    if li.product_id is not null then
      if p.user_id is not null then perform public.grant_product(p.user_id, li.product_id, p.id, src);
      elsif p.guest_email is not null then perform public.grant_product_guest(p.guest_email, li.product_id, p.id, src);
      end if;
    elsif li.course_id is not null and p.user_id is not null then
      perform public.grant_course_access(p.user_id, li.course_id, case when src = 'free' then 'free' else 'paystack' end);
    end if;
    -- A guest's course is granted when they claim the order into an account (courses need progress, quizzes, certificates).
  end loop;
end; $$;

-- Fulfilment: SERVER ONLY. Superset of 0008: orders with line items (carts, guests) + the original single-item path.
-- Still idempotent and still checks the amount AND currency against the stored order before granting anything.
create or replace function public.fulfill_payment(p_reference text, p_amount integer, p_currency text, p_paid_at timestamptz, p_channel text, p_transaction_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p record; has_items boolean;
begin
  select * into p from public.payments where reference = p_reference for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if p.status = 'successful' then
    return jsonb_build_object('ok', true, 'already', true, 'payment_id', p.id, 'user_id', p.user_id, 'course_id', p.course_id, 'product_id', p.product_id, 'guest_email', p.guest_email);
  end if;
  if p.status = 'refunded' then return jsonb_build_object('ok', false, 'error', 'refunded'); end if;
  if p_amount is distinct from p.amount_minor or upper(p_currency) is distinct from p.currency then
    update public.payments set status = 'failed', failure_reason = 'amount_mismatch',
      metadata = metadata || jsonb_build_object('received_amount', p_amount, 'received_currency', p_currency) where id = p.id;
    return jsonb_build_object('ok', false, 'error', 'amount_mismatch');
  end if;

  update public.payments set status = 'successful', paid_at = coalesce(p_paid_at, now()), verified_at = now(), channel = left(p_channel, 40),
    provider_transaction_id = left(p_transaction_id, 40), failure_reason = null where id = p.id;
  select exists (select 1 from public.payment_items where payment_id = p.id) into has_items;
  if has_items then
    perform public.grant_order_items(p.id);
  else
    if p.user_id is not null and p.course_id is not null then perform public.grant_course_access(p.user_id, p.course_id, 'paystack'); end if;
    if p.user_id is not null and p.product_id is not null then perform public.grant_product(p.user_id, p.product_id, p.id, 'purchase'); end if;
  end if;
  if p.coupon_id is not null then
    insert into public.coupon_redemptions (coupon_id, user_id, course_id, product_id, payment_id, discount_minor, currency)
    values (p.coupon_id, p.user_id, p.course_id, p.product_id, p.id, p.discount_minor, p.currency) on conflict (payment_id) do nothing;
  end if;
  if p.affiliate_id is not null then perform public.record_commission(p.id); end if;
  insert into public.activity_logs (actor_id, actor_email, action, resource_type, resource_id, resource_label, metadata)
  values (null, null, 'payment verified', 'payment', p.id::text, coalesce(p.order_number, p.reference), jsonb_build_object('amount_minor', p.amount_minor, 'currency', p.currency, 'guest', p.user_id is null));
  return jsonb_build_object('ok', true, 'already', false, 'payment_id', p.id, 'user_id', p.user_id, 'course_id', p.course_id, 'product_id', p.product_id, 'guest_email', p.guest_email);
end; $$;

-- Creates an order (pending) priced by the database, or completes a free one. SERVER ONLY.
-- p_user: the signed-in buyer (server-verified) or NULL for a guest (p_email then required).
create or replace function public.create_order(p_items jsonb, p_currency text, p_code text, p_user uuid, p_email text, p_name text,
                                               p_ref text default null, p_attribution jsonb default '{}'::jsonb, p_ip_hash text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s record; q jsonb; em text; nm text; recent int; ref text; pid uuid; onum text; total int; n int;
  li jsonb; single_product uuid; single_course uuid; aff uuid; has_product boolean;
begin
  select * into s from public.shop_settings where id = true;
  if p_user is null and s.id is not null and not s.guest_checkout_enabled then return jsonb_build_object('ok', false, 'error', 'sign_in'); end if;

  if p_user is not null then
    select lower(u.email) into em from auth.users u where u.id = p_user;
    if em is null then return jsonb_build_object('ok', false, 'error', 'sign_in'); end if;
  else
    em := lower(trim(coalesce(p_email, '')));
    if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(em) > 254 then return jsonb_build_object('ok', false, 'error', 'invalid_email'); end if;
  end if;
  nm := nullif(left(regexp_replace(trim(coalesce(p_name, '')), '[\x00-\x1f<>]', '', 'g'), 120), '');

  -- Abuse limits: pending orders per buyer and per network (hashed, never the raw IP) in the last hour.
  select count(*) into recent from public.payments
   where status = 'pending' and created_at > now() - interval '1 hour' and ((p_user is not null and user_id = p_user) or (p_user is null and guest_email = em));
  if recent >= 10 then return jsonb_build_object('ok', false, 'error', 'too_many'); end if;
  if p_ip_hash is not null then
    select count(*) into recent from public.payments where created_at > now() - interval '1 hour' and metadata->>'ip_hash' = p_ip_hash;
    if recent >= 30 then return jsonb_build_object('ok', false, 'error', 'too_many'); end if;
  end if;

  q := public.order_quote(p_items, p_currency, p_code, p_user, em);
  if not (q->>'ok')::boolean then return q; end if;
  select bool_or(value->>'kind' = 'product') into has_product from jsonb_array_elements(q->'items');
  if has_product and s.id is not null and not s.enabled then return jsonb_build_object('ok', false, 'error', 'shop_closed'); end if;

  total := (q->>'total')::int;
  n := jsonb_array_length(q->'items');
  if n = 1 then
    li := q->'items'->0;
    single_product := case when li->>'kind' = 'product' then (li->>'id')::uuid end;
    single_course := nullif(li->>'course_id', '')::uuid;
  end if;
  aff := public.resolve_affiliate(p_ref, p_user);
  ref := 'FA-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  insert into public.payments (user_id, guest_email, customer_name, course_id, product_id, reference, amount_minor, base_amount_minor, discount_minor, tax_minor,
                               coupon_id, currency, provider, status, affiliate_id, attribution, metadata)
  values (p_user, case when p_user is null then em end, nm, single_course, single_product, ref, total, (q->>'subtotal')::int, (q->>'discount')::int, 0,
          nullif(q->>'coupon_id', '')::uuid, q->>'currency', case when total = 0 then 'free' else 'paystack' end, 'pending', aff,
          public.clean_attribution(coalesce(p_attribution, '{}'::jsonb)), jsonb_strip_nulls(jsonb_build_object('ip_hash', p_ip_hash, 'items', n)))
  returning id, order_number into pid, onum;
  for li in select value from jsonb_array_elements(q->'items') loop
    insert into public.payment_items (payment_id, product_id, course_id, name, unit_minor)
    values (pid, case when li->>'kind' = 'product' then (li->>'id')::uuid end, case when li->>'kind' = 'course' then (li->>'id')::uuid end, left(li->>'name', 200), (li->>'unit')::int);
  end loop;

  if total = 0 then
    perform public.fulfill_payment(ref, 0, q->>'currency', now(), 'free', null);
  end if;
  return q || jsonb_build_object('reference', ref, 'order_number', onum, 'payment_id', pid, 'email', em, 'free', total = 0, 'guest', p_user is null);
end; $$;

-- Records which provider handles an order (server-only twin of set_payment_provider, which needs a signed-in owner).
create or replace function public.set_order_provider(p_reference text, p_provider text, p_method text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.payment_providers where id = p_provider and enabled) then return false; end if;
  if p_method is not null and p_method !~ '^[a-z_]{2,30}$' then return false; end if;
  update public.payments set provider = p_provider, payment_method = p_method
  where reference = p_reference and status = 'pending' and provider in ('paystack','flutterwave','palmpay');
  return found;
end; $$;

-- Marks a pending order as not started (provider refused / unavailable). SERVER ONLY.
create or replace function public.cancel_pending_order(p_reference text) returns void
language sql security definer set search_path = public as $$
  update public.payments set status = 'failed', failure_reason = 'not_started' where reference = p_reference and status = 'pending';
$$;

-- Secure download for an ORDER (guest or account). SERVER ONLY, after the access token was verified by the server.
-- Checks: order paid, the product belongs to this order (directly or via a bundle), entitlement still active (refunds
-- and revocations stop downloads), a file exists, downloads enabled, rate limit. Logs the download.
create or replace function public.prepare_order_download(p_payment uuid, p_product uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p record; f record; recent int; s record;
begin
  select * into s from public.shop_settings where id = true;
  if s.id is not null and not s.downloads_enabled then return jsonb_build_object('ok', false, 'error', 'downloads_off'); end if;
  select * into p from public.payments where id = p_payment;
  if not found or p.status <> 'successful' then return jsonb_build_object('ok', false, 'error', 'no_access'); end if;
  if not exists (
    select 1 from public.entitlements e
    where e.product_id = p_product and e.status = 'active'
      and (e.payment_id = p.id or (p.user_id is not null and e.user_id = p.user_id))
  ) then return jsonb_build_object('ok', false, 'error', 'no_access'); end if;
  select * into f from public.product_files where product_id = p_product;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_file'); end if;
  select count(*) into recent from public.product_downloads where payment_id = p.id and created_at > now() - interval '1 hour';
  if recent >= 30 then return jsonb_build_object('ok', false, 'error', 'rate_limited'); end if;
  insert into public.product_downloads (user_id, product_id, payment_id) values (p.user_id, p_product, p.id);
  insert into public.commerce_events (event, product_id, payment_id, guest) values ('download', p_product, p.id, p.user_id is null);
  return jsonb_build_object('ok', true, 'file_path', f.file_path, 'file_name', f.file_name);
end; $$;

-- Claims paid guest orders into an account. SERVER ONLY: the server has verified BOTH a signed-in session (p_user)
-- AND a valid access token for each order (proof the claimer received the purchase). Never by email alone.
-- Nothing is duplicated: the guest entitlement is moved to the account; if the account already owned that product the
-- guest copy is marked 'merged'. Courses in the order become enrolments now.
create or replace function public.claim_orders(p_user uuid, p_payments uuid[]) returns integer
language plpgsql security definer set search_path = public as $$
declare pay record; e record; li record; n int := 0;
begin
  if p_user is null then return 0; end if;
  for pay in select * from public.payments where id = any(p_payments) and status = 'successful' loop
    continue when pay.user_id is not null and pay.user_id <> p_user; -- belongs to another account
    update public.payments set user_id = p_user where id = pay.id and user_id is null;
    update public.entitlements x set user_id = p_user
     where x.payment_id = pay.id and x.user_id is null and x.status = 'active'
       and not exists (select 1 from public.entitlements y where y.user_id = p_user and y.product_id = x.product_id);
    update public.entitlements set status = 'merged', revoked_at = now() where payment_id = pay.id and user_id is null and status = 'active';
    for e in select pr.course_id from public.entitlements x join public.products pr on pr.id = x.product_id
              where x.payment_id = pay.id and x.user_id = p_user and x.status = 'active' and pr.product_type = 'course' and pr.course_id is not null loop
      perform public.grant_course_access(p_user, e.course_id, 'paystack');
    end loop;
    for li in select course_id from public.payment_items where payment_id = pay.id and course_id is not null loop
      perform public.grant_course_access(p_user, li.course_id, case when pay.amount_minor = 0 then 'free' else 'paystack' end);
    end loop;
    if pay.user_id is null and pay.course_id is not null and not exists (select 1 from public.payment_items where payment_id = pay.id) then
      perform public.grant_course_access(p_user, pay.course_id, 'paystack');
    end if;
    insert into public.commerce_events (event, payment_id, guest) values ('account_claimed', pay.id, true);
    n := n + 1;
  end loop;
  return n;
end; $$;

-- Automations for guest purchases use the email's contact (if one exists); never blocks the purchase.
create or replace function public.trg_entitlement_events() returns trigger
language plpgsql security definer set search_path = public as $$
declare cid uuid; ptype text;
begin
  if new.source in ('purchase','free','manual','gift') and new.status = 'active' then
    cid := coalesce(public.contact_for_user(new.user_id), (select id from public.contacts where email = new.guest_email limit 1));
    if cid is not null then
      perform public.enqueue_automations('product_purchased', cid, new.product_id::text);
      select product_type into ptype from public.products where id = new.product_id;
      if ptype = 'ebook' then perform public.enqueue_automations('ebook_purchased', cid, new.product_id::text); end if;
    end if;
  end if;
  return new;
exception when others then return new;
end; $$;

-- ═════════════════════════ ACCESS ═════════════════════════
alter table public.payment_items enable row level security;
alter table public.order_access_tokens enable row level security;
alter table public.commerce_events enable row level security;

drop policy if exists payment_items_read on public.payment_items;
create policy payment_items_read on public.payment_items for select to authenticated
  using (exists (select 1 from public.payments p where p.id = payment_id and (p.user_id = auth.uid() or public.has_admin_permission('payments') or public.has_admin_permission('customers'))));
drop policy if exists commerce_events_admin_read on public.commerce_events;
create policy commerce_events_admin_read on public.commerce_events for select to authenticated using (public.has_admin_permission('payments'));
-- order_access_tokens: no policies at all → no browser role can read or write it.

revoke all on public.payment_items, public.order_access_tokens, public.commerce_events from anon, authenticated;
grant select on public.payment_items, public.commerce_events to authenticated;
revoke usage on sequence public.order_number_seq from anon, authenticated;

revoke all on function public.order_quote(jsonb, text, text, uuid, text), public.grant_product_guest(text, uuid, uuid, text), public.grant_order_items(uuid),
  public.create_order(jsonb, text, text, uuid, text, text, text, jsonb, text), public.set_order_provider(text, text, text), public.cancel_pending_order(text),
  public.prepare_order_download(uuid, uuid), public.claim_orders(uuid, uuid[]), public.fulfill_payment(text, integer, text, timestamptz, text, text)
  from public, anon, authenticated;
grant execute on function public.order_quote(jsonb, text, text, uuid, text), public.create_order(jsonb, text, text, uuid, text, text, text, jsonb, text),
  public.set_order_provider(text, text, text), public.cancel_pending_order(text), public.prepare_order_download(uuid, uuid), public.claim_orders(uuid, uuid[]),
  public.fulfill_payment(text, integer, text, timestamptz, text, text) to service_role;
