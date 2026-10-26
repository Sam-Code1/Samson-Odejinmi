-- Fola Academy 0020: structured, verified bank details for affiliate payouts.
-- Idempotent: safe to run more than once. Nothing is deleted; existing free-text payout details are kept.
--
-- The app checks the account with the bank (Paystack "resolve account") on the server, then saves the details through
-- set_affiliate_payout, which only the server (service role) can call. Affiliates can't write these columns or mark
-- themselves verified, and the old free-text writer is closed.

alter table public.affiliates
  add column if not exists payout_bank_name text,
  add column if not exists payout_bank_code text,
  add column if not exists payout_account_number text,
  add column if not exists payout_account_name text,
  add column if not exists payout_verified boolean not null default false,
  add column if not exists payout_verified_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'affiliates_payout_account_check') then
    alter table public.affiliates add constraint affiliates_payout_account_check check (payout_account_number is null or payout_account_number ~ '^[0-9]{10}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'affiliates_payout_names_check') then
    alter table public.affiliates add constraint affiliates_payout_names_check check (
      (payout_bank_name is null or char_length(payout_bank_name) <= 120) and (payout_bank_code is null or payout_bank_code ~ '^[0-9A-Za-z]{2,12}$') and (payout_account_name is null or char_length(payout_account_name) <= 160));
  end if;
end $$;

-- SERVER ONLY. Records the bank details after the server has checked them with the bank.
create or replace function public.set_affiliate_payout(p_user uuid, p_bank_name text, p_bank_code text, p_account_number text, p_account_name text, p_verified boolean) returns boolean
language plpgsql security definer set search_path = public as $$
declare an text := nullif(trim(coalesce(p_account_name, '')), ''); bn text := nullif(trim(coalesce(p_bank_name, '')), '');
begin
  update public.affiliates set
    payout_bank_name = left(bn, 120),
    payout_bank_code = nullif(trim(coalesce(p_bank_code, '')), ''),
    payout_account_number = nullif(trim(coalesce(p_account_number, '')), ''),
    payout_account_name = left(an, 160),
    payout_verified = coalesce(p_verified, false) and an is not null,
    payout_verified_at = case when coalesce(p_verified, false) then now() end,
    payout_details = left(concat_ws(E'\n', bn, nullif(trim(coalesce(p_account_number, '')), ''), an), 500)
  where user_id = p_user;
  return found;
end; $$;
revoke all on function public.set_affiliate_payout(uuid, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.set_affiliate_payout(uuid, text, text, text, text, boolean) to service_role;

-- Free text can no longer be written by the affiliate directly: payout details go through the verified path above.
revoke execute on function public.update_my_affiliate_payout(text) from public, anon, authenticated;

-- The affiliate's own numbers (0019) plus their saved payout account, with the number masked.
create or replace function public.my_affiliate_summary() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a record;
begin
  select * into a from public.affiliates where user_id = auth.uid();
  if not found then return null; end if;
  return jsonb_build_object(
    'code', a.code, 'status', a.status, 'rate_bps', a.commission_rate_bps, 'payout_details', case when a.payout_account_number is null then a.payout_details end, 'created_at', a.created_at,
    'payout_bank', a.payout_bank_name, 'payout_last4', right(a.payout_account_number, 4), 'payout_name', a.payout_account_name, 'payout_verified', a.payout_verified,
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
revoke all on function public.my_affiliate_summary() from public, anon;
grant execute on function public.my_affiliate_summary() to authenticated;
