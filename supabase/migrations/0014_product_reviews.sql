-- 0014: Product reviews and ratings. Requires 0013. Idempotent and non-destructive.
--
-- Rules:
--   - Only people who OWN the product can review it (signed-in owners, or guest buyers through their order's private
--     token, checked by the server). There are no anonymous or unverified reviews, so every review is a verified
--     purchase, and "verified" is set by the database, never by the browser.
--   - One review per account per product (or per guest order per product). Editing sends it back to moderation.
--   - New and edited reviews are 'pending'; only 'approved' reviews are public. Admins approve / reject / hide / delete.
--   - Reports: signed-in users can report a review once; 3 reports move an approved review to 'flagged' (hidden until
--     an admin looks at it).
--   - Ratings are computed from approved reviews only. Nothing is seeded.

do $$
begin
  if to_regclass('public.payment_items') is null then raise exception 'Run 0013_guest_commerce.sql first, then this file.'; end if;
end $$;

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 60),
  rating smallint not null check (rating between 1 and 5),
  title text check (title is null or char_length(title) <= 120),
  body text check (body is null or char_length(body) <= 4000),
  verified boolean not null default false,
  status text not null default 'pending' check (status in ('pending','approved','rejected','hidden','flagged')),
  report_count integer not null default 0 check (report_count >= 0),
  moderated_by uuid references auth.users(id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists product_reviews_user_key on public.product_reviews (product_id, user_id) where user_id is not null;
create unique index if not exists product_reviews_guest_key on public.product_reviews (product_id, payment_id) where user_id is null;
create index if not exists product_reviews_public_idx on public.product_reviews (product_id, status, created_at desc);
create index if not exists product_reviews_status_idx on public.product_reviews (status, created_at desc);
drop trigger if exists trg_product_reviews_updated on public.product_reviews;
create trigger trg_product_reviews_updated before update on public.product_reviews for each row execute function public.set_updated_at();

create table if not exists public.review_reports (
  review_id uuid not null references public.product_reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

alter table public.product_reviews enable row level security;
alter table public.review_reports enable row level security;
drop policy if exists product_reviews_own_read on public.product_reviews;
create policy product_reviews_own_read on public.product_reviews for select to authenticated
  using (user_id = auth.uid() or public.has_admin_permission('products'));
drop policy if exists product_reviews_admin_update on public.product_reviews;
create policy product_reviews_admin_update on public.product_reviews for update to authenticated
  using (public.has_admin_permission('products')) with check (public.has_admin_permission('products'));
drop policy if exists product_reviews_admin_delete on public.product_reviews;
create policy product_reviews_admin_delete on public.product_reviews for delete to authenticated using (public.has_admin_permission('products'));
revoke all on public.product_reviews, public.review_reports from anon, authenticated;
grant select, delete on public.product_reviews to authenticated;
grant update (status, moderated_by, moderated_at) on public.product_reviews to authenticated;

-- Shared cleaner for user text (no control characters, trimmed).
create or replace function public.clean_text(t text, max_len int) returns text
language sql immutable set search_path = public as $$
  select nullif(left(trim(regexp_replace(coalesce(t, ''), '[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', 'g')), max_len), '');
$$;

-- Signed-in owner submits or edits their review (back to pending).
create or replace function public.submit_review(p_product uuid, p_rating int, p_title text, p_body text, p_display_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s record; nm text; recent int;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'sign_in'); end if;
  select * into s from public.shop_settings where id = true;
  if s.id is not null and not s.reviews_enabled then return jsonb_build_object('ok', false, 'error', 'reviews_off'); end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then return jsonb_build_object('ok', false, 'error', 'rating'); end if;
  if not public.user_owns_product(auth.uid(), p_product) then return jsonb_build_object('ok', false, 'error', 'not_purchased'); end if;
  select count(*) into recent from public.product_reviews where user_id = auth.uid() and updated_at > now() - interval '1 hour';
  if recent >= 10 then return jsonb_build_object('ok', false, 'error', 'too_many'); end if;
  nm := coalesce(public.clean_text(p_display_name, 60), 'Verified buyer');
  insert into public.product_reviews (product_id, user_id, display_name, rating, title, body, verified, status)
  values (p_product, auth.uid(), nm, p_rating, public.clean_text(p_title, 120), public.clean_text(p_body, 4000), true, 'pending')
  on conflict (product_id, user_id) where user_id is not null do update
    set display_name = excluded.display_name, rating = excluded.rating, title = excluded.title, body = excluded.body,
        verified = true, status = 'pending', moderated_by = null, moderated_at = null;
  insert into public.commerce_events (event, product_id, guest) values ('review_submitted', p_product, false);
  return jsonb_build_object('ok', true);
end; $$;

-- Guest buyer (or the account that claimed the order) reviews via the order. SERVER ONLY: the server verified the
-- order's private token first. The order must be paid and must still entitle that product.
create or replace function public.submit_order_review(p_payment uuid, p_product uuid, p_rating int, p_title text, p_body text, p_display_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s record; pay record; nm text;
begin
  select * into s from public.shop_settings where id = true;
  if s.id is not null and (not s.reviews_enabled or not s.guest_reviews_enabled) then return jsonb_build_object('ok', false, 'error', 'reviews_off'); end if;
  if p_rating is null or p_rating < 1 or p_rating > 5 then return jsonb_build_object('ok', false, 'error', 'rating'); end if;
  select * into pay from public.payments where id = p_payment;
  if not found or pay.status <> 'successful' then return jsonb_build_object('ok', false, 'error', 'not_purchased'); end if;
  if not exists (select 1 from public.entitlements e where e.product_id = p_product and e.status = 'active'
                 and (e.payment_id = pay.id or (pay.user_id is not null and e.user_id = pay.user_id))) then
    return jsonb_build_object('ok', false, 'error', 'not_purchased');
  end if;
  nm := coalesce(public.clean_text(p_display_name, 60), public.clean_text(pay.customer_name, 60), 'Verified buyer');
  if pay.user_id is not null then
    insert into public.product_reviews (product_id, user_id, payment_id, display_name, rating, title, body, verified, status)
    values (p_product, pay.user_id, pay.id, nm, p_rating, public.clean_text(p_title, 120), public.clean_text(p_body, 4000), true, 'pending')
    on conflict (product_id, user_id) where user_id is not null do update
      set display_name = excluded.display_name, rating = excluded.rating, title = excluded.title, body = excluded.body, verified = true, status = 'pending', moderated_by = null, moderated_at = null;
  else
    insert into public.product_reviews (product_id, user_id, payment_id, display_name, rating, title, body, verified, status)
    values (p_product, null, pay.id, nm, p_rating, public.clean_text(p_title, 120), public.clean_text(p_body, 4000), true, 'pending')
    on conflict (product_id, payment_id) where user_id is null do update
      set display_name = excluded.display_name, rating = excluded.rating, title = excluded.title, body = excluded.body, verified = true, status = 'pending', moderated_by = null, moderated_at = null;
  end if;
  insert into public.commerce_events (event, product_id, payment_id, guest) values ('review_submitted', p_product, pay.id, pay.user_id is null);
  return jsonb_build_object('ok', true);
end; $$;

-- Public: approved reviews only, safe columns only (no user ids, emails or orders).
create or replace function public.product_reviews_public(p_product uuid, p_limit int default 10, p_offset int default 0)
returns table (id uuid, display_name text, rating smallint, title text, body text, verified boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.id, r.display_name, r.rating, r.title, r.body, r.verified, r.created_at
  from public.product_reviews r join public.products p on p.id = r.product_id and p.status = 'published'
  where r.product_id = p_product and r.status = 'approved'
  order by r.created_at desc limit least(greatest(coalesce(p_limit, 10), 1), 50) offset greatest(coalesce(p_offset, 0), 0);
$$;
-- Public: average and count of approved reviews, per published product (for cards, product pages, structured data).
create or replace function public.product_ratings(p_products uuid[] default null)
returns table (product_id uuid, average numeric, review_count integer)
language sql stable security definer set search_path = public as $$
  select r.product_id, round(avg(r.rating)::numeric, 1), count(*)::int
  from public.product_reviews r join public.products p on p.id = r.product_id and p.status = 'published'
  where r.status = 'approved' and (p_products is null or r.product_id = any(p_products))
  group by r.product_id;
$$;

-- Signed-in users may report a review once. Three reports hide an approved review until an admin decides.
create or replace function public.report_review(p_review uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  insert into public.review_reports (review_id, user_id) values (p_review, auth.uid()) on conflict do nothing;
  if not found then return true; end if;
  update public.product_reviews set report_count = report_count + 1,
    status = case when status = 'approved' and report_count + 1 >= 3 then 'flagged' else status end
  where id = p_review;
  return true;
end; $$;

revoke all on function public.submit_review(uuid, int, text, text, text), public.submit_order_review(uuid, uuid, int, text, text, text),
  public.product_reviews_public(uuid, int, int), public.product_ratings(uuid[]), public.report_review(uuid), public.clean_text(text, int) from public, anon, authenticated;
grant execute on function public.submit_review(uuid, int, text, text, text), public.report_review(uuid) to authenticated;
grant execute on function public.product_reviews_public(uuid, int, int), public.product_ratings(uuid[]) to anon, authenticated;
grant execute on function public.submit_order_review(uuid, uuid, int, text, text, text) to service_role;
