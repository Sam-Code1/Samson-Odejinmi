-- 0011: buyers can always see what they own.
-- Before this, products were only readable while published, so an owned ebook/guide/bundle vanished from the
-- buyer's Library (and purchase history) as soon as it was unpublished or archived. Requires 0008. Idempotent,
-- non-destructive, read access only: owners see the product row (name, type, slug), never other people's data,
-- and files still go only through prepare_product_download (entitlement check + signed 60-second link).

do $$
begin
  if to_regclass('public.products') is null or to_regprocedure('public.user_owns_product(uuid,uuid)') is null then
    raise exception 'Run 0008_batch3_products_marketing.sql first, then this file.';
  end if;
end $$;

-- Caller-only ownership check (user_owns_product itself stays server-only: it takes any user id).
create or replace function public.i_own_product(p_product uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public.user_owns_product(auth.uid(), p_product);
$$;
revoke all on function public.i_own_product(uuid) from public;
grant execute on function public.i_own_product(uuid) to authenticated;

drop policy if exists products_owner_read on public.products;
create policy products_owner_read on public.products for select to authenticated
  using (public.i_own_product(id));
