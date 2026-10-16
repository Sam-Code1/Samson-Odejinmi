-- 0010: Shop on/off switch (Admin → Products → Shop settings).
-- Requires 0008 (products, payments.product_id) and 0009 (shop_settings). Idempotent and non-destructive:
-- the shop stays open exactly as before until an admin closes it.
--
-- When the shop is closed:
--   * the shop and product pages show a "closed" message (the app reads shop_settings.enabled),
--   * the database refuses to start any new product checkout (trigger below), whatever the browser sends,
--   * everything already bought stays in buyers' libraries and downloads keep working,
--   * course checkout from the course pages is not affected (it never sets payments.product_id).

do $$
begin
  if to_regclass('public.shop_settings') is null or to_regclass('public.products') is null then
    raise exception 'Run 0008_batch3_products_marketing.sql and 0009_batch4_finalization.sql first, then this file.';
  end if;
end $$;

alter table public.shop_settings add column if not exists enabled boolean not null default true;
alter table public.shop_settings add column if not exists closed_title text;
alter table public.shop_settings add column if not exists closed_body text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shop_settings_closed_title_len') then
    alter table public.shop_settings add constraint shop_settings_closed_title_len check (closed_title is null or char_length(closed_title) <= 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'shop_settings_closed_body_len') then
    alter table public.shop_settings add constraint shop_settings_closed_body_len check (closed_body is null or char_length(closed_body) <= 400);
  end if;
end $$;

-- Public, read-only: is the shop open? (Missing row = open, matching the default.)
create or replace function public.shop_is_open() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from public.shop_settings where id = true), true);
$$;
grant execute on function public.shop_is_open() to anon, authenticated;

-- Server-side enforcement: no new product payment (paid or free) while the shop is closed.
create or replace function public.enforce_shop_open() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.product_id is not null and not public.shop_is_open() then
    raise exception 'shop_closed' using errcode = 'P0001', hint = 'The shop is closed in Admin → Products → Shop settings.';
  end if;
  return new;
end $$;

drop trigger if exists trg_payments_shop_open on public.payments;
create trigger trg_payments_shop_open before insert on public.payments
  for each row execute function public.enforce_shop_open();
