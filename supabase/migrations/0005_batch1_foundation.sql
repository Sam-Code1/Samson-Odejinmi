-- 0005: Batch 1 foundation. Admin roles + owner, admin management, coupons, Paystack checkout/fulfilment,
-- certificates (new numbering, quiz requirement, verification), progress/quiz fixes, security attempts, RLS tightening.
-- Run AFTER 0001–0004. IDEMPOTENT and NON-DESTRUCTIVE: no tables or rows are dropped. Policies are replaced with
-- stricter, role-aware versions. Existing certificate numbers stay valid.

-- ═════════════════════════ ADMIN ROLES ═════════════════════════
alter table public.admin_users
  add column if not exists role text not null default 'super_admin',
  add column if not exists status text not null default 'active',
  add column if not exists added_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();
alter table public.admin_users drop constraint if exists admin_users_role_check;
alter table public.admin_users add constraint admin_users_role_check check (role in ('owner','super_admin','academy_admin','content_manager','support'));
alter table public.admin_users drop constraint if exists admin_users_status_check;
alter table public.admin_users add constraint admin_users_status_check check (status in ('active','disabled'));

-- The existing (earliest) admin account becomes the Owner. No account is created and no password is touched.
update public.admin_users set role = 'owner'
where user_id = (select user_id from public.admin_users order by created_at, user_id limit 1)
  and not exists (select 1 from public.admin_users where role = 'owner');
create unique index if not exists admin_users_single_owner on public.admin_users ((true)) where role = 'owner';

-- Lets admin screens join admins to their names/emails (profiles exist for every user since 0002's backfill).
insert into public.profiles (id, email) select a.user_id, u.email from public.admin_users a join auth.users u on u.id = a.user_id on conflict (id) do nothing;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'admin_users_profile_fk') then
    alter table public.admin_users add constraint admin_users_profile_fk foreign key (user_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

drop trigger if exists trg_admin_users_updated on public.admin_users;
create trigger trg_admin_users_updated before update on public.admin_users for each row execute function public.set_updated_at();

-- Active admins only. A disabled admin loses every admin capability on the next request.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid() and status = 'active');
$$;

create or replace function public.admin_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.admin_users where user_id = auth.uid() and status = 'active';
$$;

-- Single source of truth for role → permission. Mirrored (for UI only) in src/lib/admin/roles.ts.
create or replace function public.has_admin_permission(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select case a.role
      when 'owner' then true
      when 'super_admin' then p <> 'admins'
      when 'academy_admin' then p in ('academy','media','ai','students','enrolments','certificates')
      when 'content_manager' then p in ('website','media','coupons')
      when 'support' then p in ('students','enrolments')
      else false end
    from public.admin_users a where a.user_id = auth.uid() and a.status = 'active'), false);
$$;
grant execute on function public.is_admin(), public.admin_role(), public.has_admin_permission(text) to anon, authenticated;

-- ───────────── admin management (Owner only) ─────────────
create or replace function public.admin_upsert(p_email text, p_role text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid; existing text;
begin
  if not public.has_admin_permission('admins') then raise exception 'not authorised'; end if;
  if p_role not in ('super_admin','academy_admin','content_manager','support') then raise exception 'invalid role'; end if;
  select id into uid from public.profiles where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'no account'; end if;
  select role into existing from public.admin_users where user_id = uid;
  if existing = 'owner' then raise exception 'cannot change owner'; end if;
  insert into public.admin_users (user_id, role, status, added_by) values (uid, p_role, 'active', auth.uid())
  on conflict (user_id) do update set role = excluded.role, status = 'active';
  return uid;
end; $$;

create or replace function public.admin_set_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_permission('admins') then raise exception 'not authorised'; end if;
  if p_role not in ('super_admin','academy_admin','content_manager','support') then raise exception 'invalid role'; end if;
  if exists (select 1 from public.admin_users where user_id = p_user and role = 'owner') then raise exception 'cannot change owner'; end if;
  update public.admin_users set role = p_role where user_id = p_user;
  if not found then raise exception 'not an admin'; end if;
end; $$;

create or replace function public.admin_set_status(p_user uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_permission('admins') then raise exception 'not authorised'; end if;
  if p_status not in ('active','disabled') then raise exception 'invalid status'; end if;
  if exists (select 1 from public.admin_users where user_id = p_user and role = 'owner') then raise exception 'cannot change owner'; end if;
  update public.admin_users set status = p_status where user_id = p_user;
  if not found then raise exception 'not an admin'; end if;
end; $$;

create or replace function public.admin_remove(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_permission('admins') then raise exception 'not authorised'; end if;
  if exists (select 1 from public.admin_users where user_id = p_user and role = 'owner') then raise exception 'cannot change owner'; end if;
  delete from public.admin_users where user_id = p_user; -- removes admin access only; the person's account and student data stay
end; $$;

-- Safe ownership transfer: exactly one owner at all times. The previous owner becomes a Super Admin.
create or replace function public.admin_transfer_ownership(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.admin_role() is distinct from 'owner' then raise exception 'not authorised'; end if;
  if p_user = auth.uid() then raise exception 'already owner'; end if;
  if not exists (select 1 from public.admin_users where user_id = p_user and status = 'active') then raise exception 'not an active admin'; end if;
  update public.admin_users set role = 'super_admin' where user_id = auth.uid();
  update public.admin_users set role = 'owner' where user_id = p_user;
end; $$;

revoke all on function public.admin_upsert(text, text), public.admin_set_role(uuid, text), public.admin_set_status(uuid, text),
  public.admin_remove(uuid), public.admin_transfer_ownership(uuid) from public, anon;
grant execute on function public.admin_upsert(text, text), public.admin_set_role(uuid, text), public.admin_set_status(uuid, text),
  public.admin_remove(uuid), public.admin_transfer_ownership(uuid) to authenticated;

-- ───────────── security attempts (step-up confirmation rate limiting) ─────────────
create table if not exists public.security_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind ~ '^[a-z_]{3,40}$'),
  success boolean not null,
  created_at timestamptz not null default now()
);
create index if not exists security_attempts_user_idx on public.security_attempts (user_id, kind, created_at desc);
alter table public.security_attempts enable row level security;
drop policy if exists security_attempts_own_read on public.security_attempts;
create policy security_attempts_own_read on public.security_attempts for select to authenticated using (user_id = auth.uid());
drop policy if exists security_attempts_own_insert on public.security_attempts;
create policy security_attempts_own_insert on public.security_attempts for insert to authenticated with check (user_id = auth.uid());
revoke all on public.security_attempts from anon, authenticated;
grant select, insert on public.security_attempts to authenticated;

-- ═════════════════════════ ACTIVITY LOG ═════════════════════════
alter table public.activity_logs add column if not exists metadata jsonb not null default '{}'::jsonb;

-- ═════════════════════════ COURSES / LESSONS ═════════════════════════
alter table public.courses add column if not exists certificate_requires_quizzes boolean not null default false;
alter table public.enrolments drop constraint if exists enrolments_source_check;
alter table public.enrolments add constraint enrolments_source_check check (source in ('manual','paystack','gift','free'));

-- Students may only record progress on published lessons of courses they're enrolled in.
drop policy if exists progress_insert_own on public.lesson_progress;
create policy progress_insert_own on public.lesson_progress for insert to authenticated
  with check (user_id = auth.uid() and public.is_enrolled(course_id)
              and exists (select 1 from public.lessons l where l.id = lesson_id and l.course_id = lesson_progress.course_id and l.status = 'published'));
drop policy if exists progress_update_own on public.lesson_progress;
create policy progress_update_own on public.lesson_progress for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_enrolled(course_id)
              and exists (select 1 from public.lessons l where l.id = lesson_id and l.course_id = lesson_progress.course_id and l.status = 'published'));

-- ═════════════════════════ COUPONS ═════════════════════════
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[A-Z0-9_-]{3,32}$'),
  description text,
  discount_type text not null check (discount_type in ('percentage','fixed_amount')),
  discount_value integer not null check (discount_value > 0),           -- percent (1–100) or minor units (kobo/cents)
  currency text check (currency is null or currency ~ '^[A-Z]{3}$'),    -- required for fixed amounts and minimums
  active boolean not null default true,
  starts_at timestamptz,
  expires_at timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  per_user_limit integer check (per_user_limit is null or per_user_limit > 0) default 1,
  min_amount_minor integer check (min_amount_minor is null or min_amount_minor >= 0),
  applies_to_all boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_percentage_range check (discount_type <> 'percentage' or discount_value <= 100),
  constraint coupons_fixed_currency check (discount_type <> 'fixed_amount' or currency is not null),
  constraint coupons_min_currency check (min_amount_minor is null or currency is not null),
  constraint coupons_dates check (starts_at is null or expires_at is null or starts_at < expires_at)
);
create unique index if not exists coupons_code_key on public.coupons (code);

create table if not exists public.coupon_courses (
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  primary key (coupon_id, course_id)
);

-- ═════════════════════════ PAYMENTS ═════════════════════════
alter table public.payments
  add column if not exists base_amount_minor integer check (base_amount_minor is null or base_amount_minor >= 0),
  add column if not exists discount_minor integer not null default 0 check (discount_minor >= 0),
  add column if not exists coupon_id uuid references public.coupons(id) on delete set null,
  add column if not exists channel text,
  add column if not exists provider_transaction_id text,
  add column if not exists verified_at timestamptz,
  add column if not exists failure_reason text,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();
alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check check (provider in ('paystack','free','manual'));
drop trigger if exists trg_payments_updated on public.payments;
create trigger trg_payments_updated before update on public.payments for each row execute function public.set_updated_at();
create index if not exists payments_course_idx on public.payments (course_id);

-- Redemptions are written only when a payment is confirmed (or a free checkout completes): one per payment.
create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  user_id uuid references public.profiles(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,
  payment_id uuid references public.payments(id) on delete restrict,
  discount_minor integer not null check (discount_minor >= 0),
  currency text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists coupon_redemptions_payment_key on public.coupon_redemptions (payment_id);
create index if not exists coupon_redemptions_coupon_idx on public.coupon_redemptions (coupon_id);
create index if not exists coupon_redemptions_user_idx on public.coupon_redemptions (coupon_id, user_id);

drop trigger if exists trg_coupons_updated on public.coupons;
create trigger trg_coupons_updated before update on public.coupons for each row execute function public.set_updated_at();

-- ───────────── checkout: price is always computed here, never taken from the browser ─────────────
create or replace function public.checkout_quote(p_course uuid, p_currency text, p_code text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c record; price int; cp record; disc int := 0; used int; used_me int; cur text := upper(coalesce(p_currency, ''));
        v_coupon_id uuid; v_coupon_code text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'sign_in'); end if;
  select id, title, status into c from public.courses where id = p_course;
  if not found or c.status <> 'published' then return jsonb_build_object('ok', false, 'error', 'not_available'); end if;
  if exists (select 1 from public.enrolments where user_id = auth.uid() and course_id = p_course and status in ('active','completed')) then
    return jsonb_build_object('ok', false, 'error', 'already_enrolled');
  end if;
  select amount_minor into price from public.course_pricing where course_id = p_course and currency = cur and active;
  if price is null then return jsonb_build_object('ok', false, 'error', 'no_price'); end if;

  if nullif(trim(coalesce(p_code, '')), '') is not null then
    select * into cp from public.coupons where code = upper(trim(p_code));
    if not found or not cp.active then return jsonb_build_object('ok', false, 'error', 'coupon_invalid'); end if;
    if cp.starts_at is not null and cp.starts_at > now() then return jsonb_build_object('ok', false, 'error', 'coupon_not_started'); end if;
    if cp.expires_at is not null and cp.expires_at <= now() then return jsonb_build_object('ok', false, 'error', 'coupon_expired'); end if;
    if not cp.applies_to_all and not exists (select 1 from public.coupon_courses where coupon_id = cp.id and course_id = p_course) then
      return jsonb_build_object('ok', false, 'error', 'coupon_not_applicable');
    end if;
    if cp.currency is not null and cp.currency <> cur then return jsonb_build_object('ok', false, 'error', 'coupon_currency', 'coupon_currency', cp.currency); end if;
    if cp.min_amount_minor is not null and price < cp.min_amount_minor then return jsonb_build_object('ok', false, 'error', 'coupon_minimum'); end if;
    select count(*) into used from public.coupon_redemptions where coupon_id = cp.id;
    if cp.usage_limit is not null and used >= cp.usage_limit then return jsonb_build_object('ok', false, 'error', 'coupon_used_up'); end if;
    select count(*) into used_me from public.coupon_redemptions where coupon_id = cp.id and user_id = auth.uid();
    if cp.per_user_limit is not null and used_me >= cp.per_user_limit then return jsonb_build_object('ok', false, 'error', 'coupon_already_used'); end if;
    disc := case when cp.discount_type = 'percentage' then floor(price::numeric * cp.discount_value / 100)::int else least(cp.discount_value, price) end;
    v_coupon_id := cp.id; v_coupon_code := cp.code;
  end if;

  return jsonb_build_object('ok', true, 'course_id', c.id, 'course_title', c.title, 'currency', cur, 'base', price,
                            'discount', disc, 'total', greatest(price - disc, 0), 'coupon_id', v_coupon_id, 'coupon_code', v_coupon_code);
end; $$;

-- Creates the payment record (pending) with a server-generated reference, or completes a free checkout.
create or replace function public.create_checkout(p_course uuid, p_currency text, p_code text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q jsonb; ref text; pid uuid; recent int; email text; total int;
begin
  q := public.checkout_quote(p_course, p_currency, p_code);
  if not (q->>'ok')::boolean then return q; end if;
  select count(*) into recent from public.payments where user_id = auth.uid() and status = 'pending' and created_at > now() - interval '1 hour';
  if recent >= 10 then return jsonb_build_object('ok', false, 'error', 'too_many'); end if;
  select u.email into email from auth.users u where u.id = auth.uid();
  total := (q->>'total')::int;
  ref := 'FA-' || to_char(now(), 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  if total = 0 then
    insert into public.payments (user_id, course_id, reference, amount_minor, base_amount_minor, discount_minor, coupon_id, currency, provider, status, paid_at, verified_at)
    values (auth.uid(), p_course, ref, 0, (q->>'base')::int, (q->>'discount')::int, (q->>'coupon_id')::uuid, q->>'currency', 'free', 'successful', now(), now())
    returning id into pid;
    insert into public.enrolments (user_id, course_id, status, source) values (auth.uid(), p_course, 'active', 'free')
      on conflict (user_id, course_id) do update set status = 'active', source = 'free';
    if q->>'coupon_id' is not null then
      insert into public.coupon_redemptions (coupon_id, user_id, course_id, payment_id, discount_minor, currency)
      values ((q->>'coupon_id')::uuid, auth.uid(), p_course, pid, (q->>'discount')::int, q->>'currency') on conflict (payment_id) do nothing;
    end if;
    return q || jsonb_build_object('free', true, 'reference', ref);
  end if;

  insert into public.payments (user_id, course_id, reference, amount_minor, base_amount_minor, discount_minor, coupon_id, currency, provider, status)
  values (auth.uid(), p_course, ref, total, (q->>'base')::int, (q->>'discount')::int, (q->>'coupon_id')::uuid, q->>'currency', 'paystack', 'pending');
  return q || jsonb_build_object('free', false, 'reference', ref, 'email', email);
end; $$;

create or replace function public.cancel_my_pending_payment(p_reference text) returns void
language sql security definer set search_path = public as $$
  update public.payments set status = 'failed', failure_reason = 'not_started'
  where reference = p_reference and user_id = auth.uid() and status = 'pending';
$$;

revoke all on function public.checkout_quote(uuid, text, text), public.create_checkout(uuid, text, text), public.cancel_my_pending_payment(text) from public, anon;
grant execute on function public.checkout_quote(uuid, text, text), public.create_checkout(uuid, text, text), public.cancel_my_pending_payment(text) to authenticated;

-- ───────────── fulfilment: SERVER ONLY (service role), after Paystack verification ─────────────
-- Idempotent: a second call for the same reference changes nothing and creates no duplicates.
create or replace function public.fulfill_payment(p_reference text, p_amount integer, p_currency text, p_paid_at timestamptz, p_channel text, p_transaction_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  select * into p from public.payments where reference = p_reference for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if p.status = 'successful' then return jsonb_build_object('ok', true, 'already', true, 'payment_id', p.id, 'user_id', p.user_id, 'course_id', p.course_id); end if;
  if p.status = 'refunded' then return jsonb_build_object('ok', false, 'error', 'refunded'); end if;
  if p_amount is distinct from p.amount_minor or upper(p_currency) is distinct from p.currency then
    update public.payments set status = 'failed', failure_reason = 'amount_mismatch',
      metadata = metadata || jsonb_build_object('received_amount', p_amount, 'received_currency', p_currency) where id = p.id;
    return jsonb_build_object('ok', false, 'error', 'amount_mismatch');
  end if;

  update public.payments set status = 'successful', paid_at = coalesce(p_paid_at, now()), verified_at = now(), channel = left(p_channel, 40),
    provider_transaction_id = left(p_transaction_id, 40), failure_reason = null where id = p.id;
  if p.user_id is not null and p.course_id is not null then
    insert into public.enrolments (user_id, course_id, status, source) values (p.user_id, p.course_id, 'active', 'paystack')
    on conflict (user_id, course_id) do update set
      status = case when public.enrolments.status in ('active','completed') then public.enrolments.status else 'active' end, source = 'paystack';
  end if;
  if p.coupon_id is not null then
    insert into public.coupon_redemptions (coupon_id, user_id, course_id, payment_id, discount_minor, currency)
    values (p.coupon_id, p.user_id, p.course_id, p.id, p.discount_minor, p.currency) on conflict (payment_id) do nothing;
  end if;
  insert into public.activity_logs (actor_id, actor_email, action, resource_type, resource_id, resource_label, metadata)
  values (null, null, 'payment verified', 'payment', p.id::text, p.reference, jsonb_build_object('amount_minor', p.amount_minor, 'currency', p.currency));
  return jsonb_build_object('ok', true, 'already', false, 'payment_id', p.id, 'user_id', p.user_id, 'course_id', p.course_id);
end; $$;

create or replace function public.mark_payment_failed(p_reference text, p_reason text) returns void
language sql security definer set search_path = public as $$
  update public.payments set status = 'failed', failure_reason = left(p_reason, 80) where reference = p_reference and status = 'pending';
$$;
revoke all on function public.fulfill_payment(text, integer, text, timestamptz, text, text), public.mark_payment_failed(text, text) from public, anon, authenticated;
grant execute on function public.fulfill_payment(text, integer, text, timestamptz, text, text), public.mark_payment_failed(text, text) to service_role;

-- Records a refund already made in the Paystack dashboard: payment → refunded, enrolment → refunded (access removed).
create or replace function public.admin_record_refund(p_payment uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p record;
begin
  if not public.has_admin_permission('payments') then raise exception 'not authorised'; end if;
  select * into p from public.payments where id = p_payment for update;
  if not found or p.status <> 'successful' then raise exception 'only successful payments can be refunded'; end if;
  update public.payments set status = 'refunded' where id = p.id;
  update public.enrolments set status = 'refunded' where user_id = p.user_id and course_id = p.course_id;
end; $$;
revoke all on function public.admin_record_refund(uuid) from public, anon;
grant execute on function public.admin_record_refund(uuid) to authenticated;

-- ═════════════════════════ CERTIFICATES ═════════════════════════
create sequence if not exists public.certificate_seq;
alter table public.certificates add column if not exists notified_at timestamptz;
alter table public.certificates add column if not exists issued_by uuid references auth.users(id) on delete set null;

create or replace function public.next_certificate_number() returns text
language sql volatile security definer set search_path = public as $$
  select 'FOLA-ACADEMY-CERT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.certificate_seq')::text, 6, '0');
$$;
revoke all on function public.next_certificate_number() from public, anon, authenticated;

-- Progress + completion + certificate. Certificates need every published lesson complete and, if the course requires
-- it, every published quiz passed. Never issues twice (unique user+course).
create or replace function public.recompute_course_progress(p_user uuid, p_course uuid) returns void
language plpgsql security definer set search_path = public as $$
declare total int; done int; last_l uuid; cert_on boolean; needs_quiz boolean; quizzes_ok boolean := true;
begin
  select count(*) into total from public.lessons l join public.modules m on m.id = l.module_id
    where l.course_id = p_course and l.status = 'published' and m.status = 'published';
  select count(*) into done from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id join public.modules m on m.id = l.module_id
    where lp.user_id = p_user and lp.course_id = p_course and lp.completed and l.status = 'published' and m.status = 'published';
  select lesson_id into last_l from public.lesson_progress where user_id = p_user and course_id = p_course order by updated_at desc limit 1;

  insert into public.course_progress (user_id, course_id, completed_lessons, total_lessons, percent, last_lesson_id, completed_at, updated_at)
  values (p_user, p_course, done, total, case when total = 0 then 0 else round(done * 100.0 / total, 1) end, last_l,
          case when total > 0 and done >= total then now() end, now())
  on conflict (user_id, course_id) do update set
    completed_lessons = excluded.completed_lessons, total_lessons = excluded.total_lessons, percent = excluded.percent,
    last_lesson_id = excluded.last_lesson_id,
    completed_at = case when excluded.completed_at is null then null else coalesce(public.course_progress.completed_at, excluded.completed_at) end,
    updated_at = now();

  update public.profiles set last_active_at = now() where id = p_user;

  if total > 0 and done >= total then
    update public.enrolments set status = 'completed' where user_id = p_user and course_id = p_course and status = 'active';
    select certificate_enabled, certificate_requires_quizzes into cert_on, needs_quiz from public.courses where id = p_course;
    if coalesce(needs_quiz, false) then
      select not exists (
        select 1 from public.quizzes z where z.course_id = p_course and z.status = 'published'
          and not exists (select 1 from public.quiz_attempts a where a.quiz_id = z.id and a.user_id = p_user and a.passed)
      ) into quizzes_ok;
    end if;
    if coalesce(cert_on, false) and quizzes_ok then
      insert into public.certificates (user_id, course_id, certificate_number, completed_at)
      values (p_user, p_course, public.next_certificate_number(), now())
      on conflict (user_id, course_id) do nothing;
    end if;
  elsif total > 0 then
    update public.enrolments set status = 'active' where user_id = p_user and course_id = p_course and status = 'completed';
  end if;
end; $$;
revoke all on function public.recompute_course_progress(uuid, uuid) from public, anon, authenticated;

-- Same as 0003, plus: a passed quiz re-checks completion (so quiz-gated certificates are issued).
create or replace function public.submit_quiz(p_quiz uuid, p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare q record; qu record; attempt_id uuid; attempts int;
        sel uuid[]; correct uuid[]; ok boolean; pts int; total int := 0; got int := 0; review jsonb := '[]'::jsonb; pct numeric; did_pass boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into q from public.quizzes where id = p_quiz and status = 'published';
  if not found or not public.is_enrolled(q.course_id) then raise exception 'not available'; end if;

  select count(*) into attempts from public.quiz_attempts where user_id = auth.uid() and quiz_id = q.id;
  if attempts >= 1 and not q.allow_retry then raise exception 'retries are not allowed for this quiz'; end if;
  if q.max_attempts is not null and attempts >= q.max_attempts then raise exception 'no attempts left'; end if;

  insert into public.quiz_attempts (user_id, quiz_id) values (auth.uid(), q.id) returning id into attempt_id;

  for qu in select qs.* from public.quiz_questions qq join public.questions qs on qs.id = qq.question_id
            where qq.quiz_id = q.id and qs.published and qs.review_status = 'approved' and not qs.archived
            order by qq.position, qs.created_at loop
    select coalesce(array_agg(o.id), '{}') into correct from public.question_options o where o.question_id = qu.id and o.is_correct;
    select coalesce(array_agg(t.val::uuid), '{}') into sel from jsonb_array_elements_text(coalesce(p_answers -> qu.id::text, '[]'::jsonb)) as t(val)
      where case when t.val ~ '^[0-9a-fA-F-]{36}$' then t.val::uuid in (select id from public.question_options where question_id = qu.id) else false end;
    ok := array(select unnest(sel) order by 1) = array(select unnest(correct) order by 1) and cardinality(correct) > 0;
    pts := case when ok then qu.points else 0 end;
    total := total + qu.points; got := got + pts;
    insert into public.quiz_answers (attempt_id, question_id, selected_option_ids, is_correct, points_awarded) values (attempt_id, qu.id, sel, ok, pts);
    review := review || jsonb_build_object('question_id', qu.id, 'is_correct', ok,
      'explanation', case when q.show_explanations then qu.explanation end,
      'correct_option_ids', case when q.show_explanations then to_jsonb(correct) end);
  end loop;

  pct := case when total = 0 then 0 else round(got * 100.0 / total, 1) end;
  did_pass := pct >= q.pass_mark;
  update public.quiz_attempts set score_points = got, max_points = total, percent = pct, passed = did_pass where id = attempt_id;
  update public.profiles set last_active_at = now() where id = auth.uid();
  if did_pass then perform public.recompute_course_progress(auth.uid(), q.course_id); end if;

  return jsonb_build_object('attempt_id', attempt_id, 'score', got, 'max', total, 'percent', pct, 'passed', did_pass,
                            'pass_mark', q.pass_mark, 'can_retry', q.allow_retry and (q.max_attempts is null or attempts + 1 < q.max_attempts), 'review', review);
end; $$;
revoke execute on function public.submit_quiz(uuid, jsonb) from public, anon;
grant execute on function public.submit_quiz(uuid, jsonb) to authenticated;

-- Public verification: valid/invalid, name, course, dates, issuer. No email or other private data.
create or replace function public.verify_certificate(p_number text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('valid', not ce.revoked, 'student_name', trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')),
                            'course', c.title, 'instructor', c.instructor, 'issued_at', ce.issued_at, 'completed_at', ce.completed_at,
                            'certificate_number', ce.certificate_number)
  from public.certificates ce join public.courses c on c.id = ce.course_id left join public.profiles p on p.id = ce.user_id
  where ce.certificate_number = upper(trim(p_number));
$$;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- Manual issue by an authorised admin (e.g. for an offline completion). Requires an enrolment. Never duplicates.
create or replace function public.admin_issue_certificate(p_user uuid, p_course uuid) returns text
language plpgsql security definer set search_path = public as $$
declare num text;
begin
  if not public.has_admin_permission('certificates') then raise exception 'not authorised'; end if;
  if not exists (select 1 from public.enrolments where user_id = p_user and course_id = p_course and status in ('active','completed')) then raise exception 'not enrolled'; end if;
  select certificate_number into num from public.certificates where user_id = p_user and course_id = p_course;
  if num is not null then raise exception 'already issued'; end if;
  insert into public.certificates (user_id, course_id, certificate_number, completed_at, issued_by)
  values (p_user, p_course, public.next_certificate_number(), now(), auth.uid()) returning certificate_number into num;
  return num;
end; $$;

-- Returns the caller's certificates that haven't been emailed yet, and marks them as notified (exactly once).
create or replace function public.claim_certificate_notifications() returns jsonb
language sql security definer set search_path = public as $$
  with claimed as (
    update public.certificates ce set notified_at = now()
    where ce.user_id = auth.uid() and ce.notified_at is null and not ce.revoked
    returning ce.certificate_number, ce.course_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('number', cl.certificate_number, 'course', c.title)), '[]'::jsonb)
  from claimed cl join public.courses c on c.id = cl.course_id;
$$;
revoke all on function public.admin_issue_certificate(uuid, uuid), public.claim_certificate_notifications() from public, anon;
grant execute on function public.admin_issue_certificate(uuid, uuid), public.claim_certificate_notifications() to authenticated;

-- ═════════════════════════ ADMIN FUNCTIONS: role-aware ═════════════════════════
create or replace function public.reorder_modules(p_course uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_permission('academy') then raise exception 'not authorised'; end if;
  update public.modules m set position = x.ord
    from (select id, ord from unnest(p_ids) with ordinality as t(id, ord)) x where m.id = x.id and m.course_id = p_course;
end; $$;

create or replace function public.reorder_lessons(p_module uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_permission('academy') then raise exception 'not authorised'; end if;
  update public.lessons l set position = x.ord
    from (select id, ord from unnest(p_ids) with ordinality as t(id, ord)) x where l.id = x.id and l.module_id = p_module;
end; $$;

create or replace function public.move_lesson_to_module(p_lesson uuid, p_module uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cid uuid; mcid uuid; nextpos int;
begin
  if not public.has_admin_permission('academy') then raise exception 'not authorised'; end if;
  select course_id into cid from public.lessons where id = p_lesson;
  select course_id into mcid from public.modules where id = p_module;
  if cid is null or mcid is distinct from cid then raise exception 'module must belong to the same course'; end if;
  select coalesce(max(position), 0) + 1 into nextpos from public.lessons where module_id = p_module;
  update public.lessons set module_id = p_module, position = nextpos where id = p_lesson;
end; $$;

-- Real numbers only. Revenue is returned only to roles allowed to see payments.
create or replace function public.admin_dashboard_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorised'; end if;
  return jsonb_build_object(
    'students', (select count(*) from public.profiles p where not exists (select 1 from public.admin_users a where a.user_id = p.id)),
    'active_students', (select count(*) from public.profiles p where p.last_active_at > now() - interval '30 days' and not exists (select 1 from public.admin_users a where a.user_id = p.id)),
    'active_enrolments', (select count(*) from public.enrolments where status in ('active','completed')),
    'completed_enrolments', (select count(*) from public.enrolments where status = 'completed'),
    'published_courses', (select count(*) from public.courses where status = 'published'),
    'draft_courses', (select count(*) from public.courses where status = 'draft'),
    'total_courses', (select count(*) from public.courses where status <> 'archived'),
    'lessons', (select count(*) from public.lessons),
    'quiz_attempts', (select count(*) from public.quiz_attempts),
    'certificates', (select count(*) from public.certificates where not revoked),
    'revenue', case when public.has_admin_permission('payments') then coalesce((select jsonb_object_agg(currency, total) from
                (select currency, sum(amount_minor) as total from public.payments where status = 'successful' group by currency) r), '{}'::jsonb) end
  );
end; $$;

-- ═════════════════════════ RLS: role-aware policies ═════════════════════════
-- Reads by "any active admin" stay is_admin(); writes require the area's permission.
do $$
declare r record;
begin
  for r in select * from (values
    -- table, policy, permission
    ('courses','courses_admin_write','academy'), ('course_pricing','pricing_admin_write','academy'), ('modules','modules_admin_write','academy'),
    ('lessons','lessons_admin_write','academy'), ('lesson_resources','resources_admin_write','academy'), ('quizzes','quizzes_admin_write','academy'),
    ('questions','questions_admin_all','academy'), ('question_options','options_admin_all','academy'), ('quiz_questions','quiz_questions_admin','academy'),
    ('lesson_sources','lesson_sources_admin','academy'), ('enrolments','enrolments_admin_write','enrolments'), ('media_assets','media_admin_all','media'),
    ('academy_settings','settings_admin_all','settings'), ('social_links','social_links_admin','website'), ('page_sections','page_sections_admin','website'),
    ('portfolio_projects','portfolio_admin','website'), ('portfolio_media','portfolio_media_admin','website'), ('services','services_admin','website'),
    ('contact_messages','contact_admin','website')
  ) as t(tbl, pol, perm) loop
    execute format('drop policy if exists %I on public.%I', r.pol, r.tbl);
    execute format('create policy %I on public.%I for all to authenticated using (public.has_admin_permission(%L)) with check (public.has_admin_permission(%L))', r.pol, r.tbl, r.perm, r.perm);
  end loop;
end $$;

drop policy if exists site_settings_admin on public.site_settings;
create policy site_settings_admin on public.site_settings for update to authenticated using (public.has_admin_permission('website')) with check (public.has_admin_permission('website'));
drop policy if exists seo_admin on public.seo_metadata;
create policy seo_admin on public.seo_metadata for update to authenticated using (public.has_admin_permission('website')) with check (public.has_admin_permission('website'));
drop policy if exists certificates_admin_update on public.certificates;
create policy certificates_admin_update on public.certificates for update to authenticated using (public.has_admin_permission('certificates')) with check (public.has_admin_permission('certificates'));

-- Sensitive reads narrowed to the roles that need them.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid() or public.has_admin_permission('students'));
drop policy if exists enrolments_select_own on public.enrolments;
create policy enrolments_select_own on public.enrolments for select to authenticated using (user_id = auth.uid() or public.has_admin_permission('enrolments'));
drop policy if exists payments_select_own on public.payments;
create policy payments_select_own on public.payments for select to authenticated using (user_id = auth.uid() or public.has_admin_permission('payments'));
drop policy if exists certificates_select_own on public.certificates;
create policy certificates_select_own on public.certificates for select to authenticated using (user_id = auth.uid() or public.has_admin_permission('certificates') or public.has_admin_permission('students'));
drop policy if exists attempts_select_own on public.quiz_attempts;
create policy attempts_select_own on public.quiz_attempts for select to authenticated using (user_id = auth.uid() or public.has_admin_permission('students') or public.has_admin_permission('academy'));
drop policy if exists answers_select_own on public.quiz_answers;
create policy answers_select_own on public.quiz_answers for select to authenticated
  using (exists (select 1 from public.quiz_attempts a where a.id = attempt_id and (a.user_id = auth.uid() or public.has_admin_permission('students') or public.has_admin_permission('academy'))));
drop policy if exists contact_admin on public.contact_messages;
create policy contact_admin on public.contact_messages for all to authenticated using (public.has_admin_permission('website')) with check (public.has_admin_permission('website'));
drop policy if exists activity_admin_read on public.activity_logs;
create policy activity_admin_read on public.activity_logs for select to authenticated using (public.has_admin_permission('activity'));
drop policy if exists ai_generations_admin_read on public.ai_generations;
create policy ai_generations_admin_read on public.ai_generations for select to authenticated using (public.has_admin_permission('ai'));
drop policy if exists ai_generations_admin_insert on public.ai_generations;
create policy ai_generations_admin_insert on public.ai_generations for insert to authenticated with check (public.has_admin_permission('ai') and created_by = auth.uid());

-- Previously only students could read their own progress, so admin progress reports were always empty. Fixed.
drop policy if exists course_progress_admin_read on public.course_progress;
create policy course_progress_admin_read on public.course_progress for select to authenticated using (public.has_admin_permission('students'));
drop policy if exists lesson_progress_admin_read on public.lesson_progress;
create policy lesson_progress_admin_read on public.lesson_progress for select to authenticated using (public.has_admin_permission('students'));

-- Coupons: managed by marketing roles. Students never read coupons directly (checkout uses checkout_quote()).
alter table public.coupons            enable row level security;
alter table public.coupon_courses     enable row level security;
alter table public.coupon_redemptions enable row level security;
drop policy if exists coupons_admin on public.coupons;
create policy coupons_admin on public.coupons for all to authenticated using (public.has_admin_permission('coupons')) with check (public.has_admin_permission('coupons'));
drop policy if exists coupon_courses_admin on public.coupon_courses;
create policy coupon_courses_admin on public.coupon_courses for all to authenticated using (public.has_admin_permission('coupons')) with check (public.has_admin_permission('coupons'));
drop policy if exists coupon_redemptions_read on public.coupon_redemptions;
create policy coupon_redemptions_read on public.coupon_redemptions for select to authenticated
  using (user_id = auth.uid() or public.has_admin_permission('coupons') or public.has_admin_permission('payments'));
revoke all on public.coupons, public.coupon_courses, public.coupon_redemptions from anon, authenticated;
grant select, insert, update, delete on public.coupons, public.coupon_courses to authenticated;
grant select on public.coupon_redemptions to authenticated;

-- Storage: public website/course images need the media permission; private course files need academy.
drop policy if exists "admin manage academy files" on storage.objects;
drop policy if exists "admin manage media files" on storage.objects;
create policy "admin manage media files" on storage.objects for all to authenticated
  using (bucket_id = 'academy-media' and (public.has_admin_permission('media') or public.has_admin_permission('academy') or public.has_admin_permission('website')))
  with check (bucket_id = 'academy-media' and (public.has_admin_permission('media') or public.has_admin_permission('academy') or public.has_admin_permission('website')));
drop policy if exists "admin manage course files" on storage.objects;
create policy "admin manage course files" on storage.objects for all to authenticated
  using (bucket_id = 'course-resources' and public.has_admin_permission('academy'))
  with check (bucket_id = 'course-resources' and public.has_admin_permission('academy'));
