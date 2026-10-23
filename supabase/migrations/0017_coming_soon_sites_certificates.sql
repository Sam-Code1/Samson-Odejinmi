-- Fola Academy 0017: "coming soon" courses, website projects with live previews, certificate design settings.
-- Idempotent: safe to run more than once. Nothing is deleted.
--
-- 1. Courses can be draft, coming_soon, published or archived. A coming-soon course is PUBLIC (details, outline and
--    price, if one is set) but can't be bought or enrolled in: every purchase path already requires status = 'published'
--    (free enrolment, order_quote for courses, product_checkout_quote). This migration also closes one gap: a "course"
--    product in the shop now follows its course's status too.
-- 2. Portfolio projects gain a discipline (the gallery categories) and a website preview (title, description,
--    screenshots and whether the site allows live embedding), filled in from the dashboard by pasting a link.
-- 3. Certificate design: the signatory's name, title and (optional) signature image, shown on every certificate.

-- ═════════════════════════ 1. COMING SOON ═════════════════════════
do $$ declare r record; begin
  for r in select conname from pg_constraint
           where conrelid = 'public.courses'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%status%'
  loop execute format('alter table public.courses drop constraint %I', r.conname); end loop;
end $$;
alter table public.courses add constraint courses_status_check check (status in ('draft','coming_soon','published','archived'));
alter table public.courses add column if not exists launch_note text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'courses_launch_note_check') then
    alter table public.courses add constraint courses_launch_note_check check (launch_note is null or char_length(launch_note) <= 80);
  end if;
end $$;

-- Visitors can read published and coming-soon courses, and their prices.
drop policy if exists courses_public_read on public.courses;
create policy courses_public_read on public.courses for select to anon, authenticated
  using (status in ('published','coming_soon') or public.is_admin());
drop policy if exists pricing_public_read on public.course_pricing;
create policy pricing_public_read on public.course_pricing for select to anon, authenticated
  using ((active and exists (select 1 from public.courses c where c.id = course_id and c.status in ('published','coming_soon'))) or public.is_admin());

-- The public outline (module and lesson TITLES only) is shown for coming-soon courses too. Lesson content stays
-- enrolled-only, and nobody can enrol until the course is published.
create or replace function public.public_course_curriculum(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('position', m.position, 'title', m.title,
           'lessons', (select coalesce(jsonb_agg(jsonb_build_object('title', l.title) order by l.position), '[]'::jsonb)
                       from public.lessons l where l.module_id = m.id and l.status = 'published'))
         order by m.position), '[]'::jsonb)
  from public.modules m join public.courses c on c.id = m.course_id
  where c.slug = p_slug and c.status in ('published','coming_soon') and m.status = 'published';
$$;
grant execute on function public.public_course_curriculum(text) to anon, authenticated;

-- Cart / checkout quote (from 0013) with the product → course status check added.

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
      -- 0017: a course sold as a product follows its course: draft or coming-soon courses can't be bought.
      if v_course is not null and not exists (select 1 from public.courses where id = v_course and status = 'published') then
        return jsonb_build_object('ok', false, 'error', 'not_available', 'item', pr.name);
      end if;
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
-- Same grants as 0013: server only.
revoke all on function public.order_quote(jsonb, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.order_quote(jsonb, text, text, uuid, text) to service_role;

-- ═════════════════════════ 2. WEBSITE PROJECTS ═════════════════════════
alter table public.portfolio_projects
  add column if not exists discipline text,
  add column if not exists site_preview jsonb,
  add column if not exists live_preview boolean not null default true;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'portfolio_projects_discipline_check') then
    alter table public.portfolio_projects add constraint portfolio_projects_discipline_check check (discipline is null or discipline in
      ('environment-design','product-animation','3d-animation','graphic-design','video-editing','ai-automation','software-engineering'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'portfolio_projects_site_preview_check') then
    alter table public.portfolio_projects add constraint portfolio_projects_site_preview_check
      check (site_preview is null or (jsonb_typeof(site_preview) = 'object' and pg_column_size(site_preview) < 16384));
  end if;
end $$;
create index if not exists portfolio_discipline_idx on public.portfolio_projects (discipline, display_order) where status = 'published';

-- ═════════════════════════ 3. CERTIFICATE DESIGN ═════════════════════════
alter table public.academy_settings
  add column if not exists certificate_signatory_name text not null default 'Samson Afolabi Odejinmi',
  add column if not exists certificate_signatory_title text not null default 'Founder, Fola Academy',
  add column if not exists certificate_signature_url text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'academy_settings_signature_url_check') then
    alter table public.academy_settings add constraint academy_settings_signature_url_check check (certificate_signature_url is null
      or certificate_signature_url ~ '^https://[A-Za-z0-9.-]+/storage/v1/object/public/[A-Za-z0-9/_.%-]+$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'academy_settings_signatory_check') then
    alter table public.academy_settings add constraint academy_settings_signatory_check
      check (char_length(certificate_signatory_name) between 1 and 80 and char_length(certificate_signatory_title) between 1 and 80);
  end if;
end $$;

-- Public verification, now with what the certificate artwork needs: the signatory, the course's level and duration.
-- Still never the student's email or account details.
create or replace function public.verify_certificate(p_number text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('valid', not ce.revoked, 'student_name', trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')),
                            'course', c.title, 'course_slug', c.slug, 'level', c.level, 'duration', c.estimated_duration,
                            'instructor', c.instructor, 'issued_at', ce.issued_at, 'completed_at', ce.completed_at,
                            'certificate_number', ce.certificate_number,
                            'signatory_name', s.certificate_signatory_name, 'signatory_title', s.certificate_signatory_title,
                            'signature_url', s.certificate_signature_url)
  from public.certificates ce join public.courses c on c.id = ce.course_id left join public.profiles p on p.id = ce.user_id
  left join public.academy_settings s on s.id
  where ce.certificate_number = upper(trim(p_number));
$$;
grant execute on function public.verify_certificate(text) to anon, authenticated;
