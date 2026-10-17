-- 0012: provider currency capabilities + compare-at prices. Requires 0009 (payment_providers). Idempotent, non-destructive.
--
-- Why: Admin → Payments says which currencies a provider SHOULD take, but the merchant account decides what it CAN
-- take (e.g. Paystack USD needs international payments enabled; GBP isn't offered to Nigerian businesses). Checkout
-- now records the provider's real answer here. A currency marked 'unsupported' for a provider (in that key mode:
-- test and live accounts differ) is never offered or sent to that provider again until it is re-checked.
--   status: 'supported'   the provider accepted a transaction in this currency
--           'unsupported' the provider refused the currency (e.g. Paystack 403 unsupported_currency)

do $$
begin
  if to_regclass('public.payment_providers') is null then
    raise exception 'Run 0009_batch4_finalization.sql first, then this file.';
  end if;
end $$;

create table if not exists public.payment_provider_capabilities (
  provider text not null references public.payment_providers(id) on delete cascade,
  mode text not null check (mode in ('test','live')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null check (status in ('supported','unsupported')),
  detail text check (detail is null or char_length(detail) <= 300),
  checked_at timestamptz not null default now(),
  primary key (provider, mode, currency)
);

alter table public.payment_provider_capabilities enable row level security;
-- Public read: checkout (cookie-less server reads) must know what is unsupported. Contains no secrets or personal data.
drop policy if exists provider_capabilities_read on public.payment_provider_capabilities;
create policy provider_capabilities_read on public.payment_provider_capabilities for select to anon, authenticated using (true);
-- Admins with the payments permission can clear a result (to re-check after the provider enables a currency).
drop policy if exists provider_capabilities_admin on public.payment_provider_capabilities;
create policy provider_capabilities_admin on public.payment_provider_capabilities for delete to authenticated using (public.has_admin_permission('payments'));
revoke all on public.payment_provider_capabilities from anon, authenticated;
grant select on public.payment_provider_capabilities to anon, authenticated;
grant delete on public.payment_provider_capabilities to authenticated;
-- Writes come only from trusted server code (service role) after a real provider response.

-- Optional "was" price shown struck through. Never used to compute what is charged.
alter table public.product_prices add column if not exists compare_at_minor integer;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'product_prices_compare_at_check') then
    alter table public.product_prices add constraint product_prices_compare_at_check
      check (compare_at_minor is null or (compare_at_minor > amount_minor and compare_at_minor <= 1000000000));
  end if;
end $$;
