-- Fola Academy 0018: "coming soon" books and products, plus an edition / version label.
-- Idempotent: safe to run more than once. Nothing is deleted.
--
-- A coming-soon product is PUBLIC (cover, descriptions, edition, launch note and its price, if set) but can't be
-- bought: every purchase path already requires products.status = 'published' (order_quote, product_checkout_quote),
-- so nothing changes there. Publishing opens it for sale.

do $$ declare r record; begin
  for r in select conname from pg_constraint
           where conrelid = 'public.products'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%status%'
  loop execute format('alter table public.products drop constraint %I', r.conname); end loop;
end $$;
alter table public.products add constraint products_status_check check (status in ('draft','coming_soon','published','archived'));

alter table public.products
  add column if not exists edition text,
  add column if not exists launch_note text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'products_edition_check') then
    alter table public.products add constraint products_edition_check check (edition is null or char_length(edition) <= 40);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_launch_note_check') then
    alter table public.products add constraint products_launch_note_check check (launch_note is null or char_length(launch_note) <= 80);
  end if;
end $$;

-- Visitors see published and coming-soon products, and their prices.
drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select to anon, authenticated using (status in ('published','coming_soon'));
drop policy if exists product_prices_public_read on public.product_prices;
create policy product_prices_public_read on public.product_prices for select to anon, authenticated
  using (active and exists (select 1 from public.products p where p.id = product_id and p.status in ('published','coming_soon')));
