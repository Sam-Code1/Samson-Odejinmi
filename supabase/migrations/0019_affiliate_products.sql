-- Fola Academy 0019: affiliates for everyone, with a commission rate per product.
-- Idempotent: safe to run more than once. Nothing is deleted and no existing commission changes.
--
--  • products.affiliate_enabled / products.affiliate_rate_bps: whether affiliates can promote a product, and the
--    commission it pays (1500 = 15%). Empty rate = the affiliate's own rate (10% unless an admin changed it).
--  • record_commission now prices each item in an order at its own rate (product rate, else the affiliate's rate),
--    after the order's discount, and skips items that aren't open to affiliates. Past commissions keep their rate.
--  • affiliate_offers(): what affiliates can promote and what each pays (the programme page and link builder).
--  • apply_affiliate takes an optional "how will you promote" note, so people who aren't students can say who they reach.
--  • my_affiliate_summary adds the products behind each commission and the pages people actually clicked.

alter table public.products
  add column if not exists affiliate_enabled boolean not null default true,
  add column if not exists affiliate_rate_bps integer;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'products_affiliate_rate_check') then
    alter table public.products add constraint products_affiliate_rate_check check (affiliate_rate_bps is null or affiliate_rate_bps between 0 and 9000);
  end if;
end $$;

alter table public.affiliates add column if not exists promotion_plan text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'affiliates_promotion_plan_check') then
    alter table public.affiliates add constraint affiliates_promotion_plan_check check (promotion_plan is null or char_length(promotion_plan) <= 1000);
  end if;
end $$;

-- Commission on the amount actually paid, item by item. One per payment, active affiliates only, never for the
-- affiliate's own purchase. Order discounts are shared across the items in proportion to their price.
create or replace function public.record_commission(p_payment uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record; it record; base_total bigint; comm numeric := 0; rate int; amt int;
begin
  select pay.id, pay.user_id, pay.amount_minor, pay.currency, pay.status, pay.product_id, pay.course_id,
         a.id as aff_id, a.user_id as aff_user, a.status as aff_status, a.commission_rate_bps
    into r from public.payments pay join public.affiliates a on a.id = pay.affiliate_id where pay.id = p_payment;
  if not found or r.status <> 'successful' or r.aff_status <> 'active' or r.aff_user = r.user_id or r.amount_minor <= 0 then return; end if;

  select coalesce(sum(unit_minor), 0) into base_total from public.payment_items where payment_id = r.id;
  if base_total > 0 then
    for it in
      select pi.unit_minor, x.affiliate_enabled, x.affiliate_rate_bps
        from public.payment_items pi
        left join lateral (
          select pr.affiliate_enabled, pr.affiliate_rate_bps from public.products pr
           where pr.id = pi.product_id or (pi.course_id is not null and pr.course_id = pi.course_id)
           order by (pr.id = pi.product_id) desc nulls last limit 1) x on true
       where pi.payment_id = r.id
    loop
      if coalesce(it.affiliate_enabled, true) then
        rate := coalesce(it.affiliate_rate_bps, r.commission_rate_bps);
        comm := comm + (it.unit_minor::numeric * r.amount_minor / base_total) * rate / 10000;
      end if;
    end loop;
  else
    select pr.affiliate_enabled, pr.affiliate_rate_bps into it from public.products pr
     where pr.id = r.product_id or (r.course_id is not null and pr.course_id = r.course_id)
     order by (pr.id = r.product_id) desc nulls last limit 1;
    if coalesce(it.affiliate_enabled, true) then
      comm := r.amount_minor::numeric * coalesce(it.affiliate_rate_bps, r.commission_rate_bps) / 10000;
    end if;
  end if;

  amt := floor(comm)::int;
  if amt <= 0 then return; end if;
  insert into public.affiliate_commissions (affiliate_id, payment_id, amount_minor, currency, rate_bps, status)
  values (r.aff_id, r.id, amt, r.currency, round(amt::numeric * 10000 / r.amount_minor)::int, 'pending')
  on conflict (payment_id) do nothing;
end; $$;

-- What affiliates can promote, and what each pays them. Public on purpose: it's the programme's rate card.
create or replace function public.affiliate_offers() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare own int;
begin
  select commission_rate_bps into own from public.affiliates where user_id = auth.uid();
  own := coalesce(own, 1000);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'name', p.name, 'type', p.product_type, 'slug', p.slug, 'course_slug', c.slug, 'cover', p.cover_image,
      'rate_bps', coalesce(p.affiliate_rate_bps, own)) order by p.featured desc, p.display_order, p.name)
    from public.products p left join public.courses c on c.id = p.course_id
    where p.status = 'published' and p.affiliate_enabled and coalesce(p.affiliate_rate_bps, own) > 0
  ), '[]'::jsonb);
end; $$;

-- Applying no longer requires being a student: any account can apply, and says how they will promote.
drop function if exists public.apply_affiliate(text, text);
create or replace function public.apply_affiliate(p_code text, p_payout text, p_plan text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c text := lower(trim(coalesce(p_code, '')));
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'sign_in'); end if;
  if exists (select 1 from public.affiliates where user_id = auth.uid()) then return jsonb_build_object('ok', false, 'error', 'exists'); end if;
  if c !~ '^[a-z0-9][a-z0-9_-]{2,23}$' then return jsonb_build_object('ok', false, 'error', 'bad_code'); end if;
  if exists (select 1 from public.affiliates where code = c) then return jsonb_build_object('ok', false, 'error', 'code_taken'); end if;
  insert into public.affiliates (user_id, code, status, payout_details, promotion_plan)
  values (auth.uid(), c, 'pending', left(nullif(trim(coalesce(p_payout, '')), ''), 500), left(nullif(trim(coalesce(p_plan, '')), ''), 1000));
  return jsonb_build_object('ok', true);
end; $$;

-- The affiliate's own numbers, now with the products behind each commission and the pages that were clicked.
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
    'recent', (select coalesce(jsonb_agg(jsonb_build_object('created_at', r.created_at, 'amount', r.amount_minor, 'currency', r.currency, 'status', r.status, 'rate_bps', r.rate_bps,
         'items', (select string_agg(pi.name, ', ' order by pi.name) from public.payment_items pi where pi.payment_id = r.payment_id)) order by r.created_at desc), '[]'::jsonb)
       from (select * from public.affiliate_commissions where affiliate_id = a.id order by created_at desc limit 20) r),
    'top_pages', (select coalesce(jsonb_agg(jsonb_build_object('path', landing_path, 'clicks', n) order by n desc), '[]'::jsonb) from (
       select landing_path, count(*) as n from public.affiliate_clicks
        where affiliate_id = a.id and created_at > now() - interval '30 days' and landing_path is not null
        group by landing_path order by n desc limit 8) t)
  );
end; $$;

revoke all on function public.record_commission(uuid) from public, anon, authenticated;
revoke all on function public.apply_affiliate(text, text, text) from public, anon;
grant execute on function public.apply_affiliate(text, text, text) to authenticated;
revoke all on function public.my_affiliate_summary() from public, anon;
grant execute on function public.my_affiliate_summary() to authenticated;
revoke all on function public.affiliate_offers() from public;
grant execute on function public.affiliate_offers() to anon, authenticated, service_role;
