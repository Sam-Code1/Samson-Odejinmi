-- 0003: Website CMS (main site), reusable question bank, module publishing, AI generation log, activity log.
-- Run AFTER 0001_init.sql and 0002_admin_cms.sql in the Supabase SQL editor.
-- IDEMPOTENT: safe to re-run. Every create is guarded; seed rows use ON CONFLICT DO NOTHING, so re-running never
-- overwrites content you've edited in Admin.
-- Seed content is the site's existing, real copy (previously hard-coded in src/content/*.ts). Nothing is invented.

-- ═════════════════════════════════════════ WEBSITE CMS ═════════════════════════════════════════

-- ───────────── site settings (singleton) ─────────────
create table if not exists public.site_settings (
  id boolean primary key default true check (id),
  site_name text not null default 'Samson Odejinmi',
  full_name text not null default 'Samson Afolabi Odejinmi',
  job_title text,
  site_description text,
  default_seo_title text,
  default_seo_description text,
  logo_url text,
  favicon_url text,
  default_og_image text,
  contact_email text,
  availability_message text,
  response_expectation text,
  location_text text,
  footer_text text,
  copyright_text text,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id, site_name, full_name, job_title, site_description, default_seo_title, default_seo_description,
                                  contact_email, response_expectation, footer_text, copyright_text)
values (true, 'Samson Odejinmi', 'Samson Afolabi Odejinmi', '3D Artist, Designer & Creative Technologist',
  'A 3D artist, designer and creative technologist exploring the space between visual storytelling and technology.',
  'Samson Odejinmi — 3D Artist, Designer & Creative Technologist',
  'Samson Odejinmi is a 3D artist, designer and creative technologist exploring the space between visual storytelling and technology.',
  'odejinmisamson37@gmail.com', 'I''ll reply by email.',
  'A 3D artist, designer and creative technologist exploring the space between visual storytelling and technology.',
  'Samson Afolabi Odejinmi')
on conflict (id) do nothing;

-- ───────────── social links ─────────────
-- Empty by design: only real, verified profile URLs should be added (Admin → Website → Social links).
create table if not exists public.social_links (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('linkedin','x','instagram','youtube','pinterest','github','behance','artstation','vimeo','tiktok','facebook','email','website','other')),
  label text not null,
  url text not null check (url ~ '^(https?://|mailto:)'),
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────── page sections (content blocks) ─────────────
-- Real columns for the fields every block shares; `items` holds a short ordered list (cards, timeline entries, steps)
-- and `settings` holds block-specific options. Nothing that needs filtering lives in JSON.
create table if not exists public.page_sections (
  id uuid primary key default gen_random_uuid(),
  page text not null check (page in ('home','about','services','contact','portfolio')),
  section_key text not null check (section_key ~ '^[a-z0-9_]+$'),
  label text not null,
  eyebrow text,
  title text,
  body text,
  image_url text,
  image_alt text,
  cta_label text,
  cta_href text,
  cta2_label text,
  cta2_href text,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  display_order integer not null default 0,
  status text not null default 'published' check (status in ('draft','published','archived')),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page, section_key)
);
create index if not exists page_sections_page_idx on public.page_sections (page, display_order);

-- ───────────── portfolio ─────────────
create table if not exists public.portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null,
  short_description text,
  description text,          -- overview
  challenge text,
  approach text,
  outcome text,
  process jsonb not null default '[]'::jsonb check (jsonb_typeof(process) = 'array'), -- [{title, body}]
  category text,
  categories text[] not null default '{}',
  services text[] not null default '{}',
  tools text[] not null default '{}',
  cover_image_url text,
  cover_image_alt text,
  video_provider text not null default 'none' check (video_provider in ('none','youtube')),
  video_id text check (video_id is null or video_id ~ '^[A-Za-z0-9_-]{11}$'),
  project_url text,
  external_url text,
  year integer check (year is null or year between 1990 and 2100),
  role text,
  client text,              -- only when genuinely true. Never invented.
  project_type text,        -- Personal Project, Study Project, Concept, Client Work, …
  project_status text not null default 'Personal Study',
  is_placeholder boolean not null default false,
  featured boolean not null default false, -- shown in "Selected work" on the homepage
  display_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  seo_title text,
  seo_description text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists portfolio_status_idx on public.portfolio_projects (status, display_order);

create table if not exists public.portfolio_media (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.portfolio_projects(id) on delete cascade,
  url text not null,
  alt text not null default '',
  caption text,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists portfolio_media_project_idx on public.portfolio_media (project_id, display_order);

create or replace function public.trg_publish_stamp() returns trigger
language plpgsql as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end; $$;
drop trigger if exists portfolio_publish_stamp on public.portfolio_projects;
create trigger portfolio_publish_stamp before insert or update on public.portfolio_projects for each row execute function public.trg_publish_stamp();

-- ───────────── services ─────────────
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  short_description text,
  full_description text,
  icon text,
  image_url text,
  deliverables text[] not null default '{}', -- "what it involves"
  process text[] not null default '{}',
  tools text[] not null default '{}',
  related_category text,                      -- links to /portfolio?category=…
  cta_label text,
  cta_href text,
  featured boolean not null default false,
  display_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────── SEO per route ─────────────
create table if not exists public.seo_metadata (
  route_key text primary key check (route_key in ('home','about','portfolio','services','contact','academy','academy_courses')),
  seo_title text,
  seo_description text,
  og_title text,
  og_description text,
  og_image text,
  canonical_url text,
  noindex boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.seo_metadata (route_key) values ('home'),('about'),('portfolio'),('services'),('contact'),('academy'),('academy_courses')
on conflict (route_key) do nothing;

-- ───────────── contact messages ─────────────
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  service text,
  message text not null,
  status text not null default 'new' check (status in ('new','read','archived')),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists contact_messages_status_idx on public.contact_messages (status, created_at desc);

-- The public form writes through this function only. Anonymous users can never read, update or delete messages.
create or replace function public.submit_contact_message(p_name text, p_email text, p_service text, p_message text) returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid; recent int;
begin
  if length(trim(coalesce(p_name,''))) < 2 or length(p_name) > 120 then raise exception 'invalid name'; end if;
  if coalesce(p_email,'') !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(p_email) > 200 then raise exception 'invalid email'; end if;
  if length(trim(coalesce(p_message,''))) < 10 or length(p_message) > 5000 then raise exception 'invalid message'; end if;
  -- Light abuse protection: at most 5 messages per email address per hour.
  select count(*) into recent from public.contact_messages where lower(email) = lower(trim(p_email)) and created_at > now() - interval '1 hour';
  if recent >= 5 then raise exception 'too many messages'; end if;
  insert into public.contact_messages (name, email, service, message)
  values (trim(p_name), lower(trim(p_email)), nullif(left(trim(coalesce(p_service,'')), 120), ''), trim(p_message))
  returning id into new_id;
  return new_id;
end; $$;
revoke all on function public.submit_contact_message(text, text, text, text) from public;
grant execute on function public.submit_contact_message(text, text, text, text) to anon, authenticated;

-- ───────────── activity log ─────────────
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,
  resource_type text not null,
  resource_id text,
  resource_label text,
  created_at timestamptz not null default now()
);
create index if not exists activity_logs_created_idx on public.activity_logs (created_at desc);

-- ───────────── media library: website images + metadata ─────────────
alter table public.media_assets
  add column if not exists alt_text text,
  add column if not exists caption text,
  add column if not exists archived boolean not null default false;
alter table public.media_assets drop constraint if exists media_assets_kind_check;
alter table public.media_assets add constraint media_assets_kind_check
  check (kind in ('image','thumbnail','lesson_image','document','video_meta','site_image','portfolio','og_image','logo'));

-- ═════════════════════════════════════════ ACADEMY ═════════════════════════════════════════

-- ───────────── lessons: AI source material (admin-only) ─────────────
-- Kept OUT of public.lessons on purpose: enrolled students can read lesson rows, and teaching notes are not for them.
create table if not exists public.lesson_sources (
  lesson_id uuid primary key references public.lessons(id) on delete cascade,
  transcript text,
  notes text,
  updated_at timestamptz not null default now()
);

-- ───────────── modules: draft / published ─────────────
-- Existing modules stay published so nothing disappears for enrolled students.
alter table public.modules add column if not exists status text not null default 'published';
alter table public.modules drop constraint if exists modules_status_check;
alter table public.modules add constraint modules_status_check check (status in ('draft','published'));

-- Lessons inside a draft module are hidden from students, exactly like draft lessons.
drop policy if exists lessons_read on public.lessons;
create policy lessons_read on public.lessons for select to authenticated using (
  (status = 'published' and public.is_enrolled(course_id)
   and exists (select 1 from public.modules m where m.id = lessons.module_id and m.status = 'published'))
  or public.is_admin());

create or replace function public.public_course_curriculum(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('position', m.position, 'title', m.title,
           'lessons', (select coalesce(jsonb_agg(jsonb_build_object('title', l.title) order by l.position), '[]'::jsonb)
                       from public.lessons l where l.module_id = m.id and l.status = 'published'))
         order by m.position), '[]'::jsonb)
  from public.modules m join public.courses c on c.id = m.course_id
  where c.slug = p_slug and c.status = 'published' and m.status = 'published';
$$;

-- Same as 0002, but only lessons in published modules count towards progress.
create or replace function public.recompute_course_progress(p_user uuid, p_course uuid) returns void
language plpgsql security definer set search_path = public as $$
declare total int; done int; last_l uuid; cert_on boolean;
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
    select certificate_enabled into cert_on from public.courses where id = p_course;
    if coalesce(cert_on, false) then
      insert into public.certificates (user_id, course_id, certificate_number, completed_at)
      values (p_user, p_course,
              'FA-' || to_char(now(), 'YYMM') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
              now())
      on conflict (user_id, course_id) do nothing;
    end if;
  elsif total > 0 then
    update public.enrolments set status = 'active' where user_id = p_user and course_id = p_course and status = 'completed';
  end if;
end; $$;
revoke all on function public.recompute_course_progress(uuid, uuid) from public, anon, authenticated;

-- ───────────── AI generation log (also used for rate limiting) ─────────────
create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('quiz','regenerate','content')),
  course_id uuid references public.courses(id) on delete set null,
  lesson_id uuid references public.lessons(id) on delete set null,
  provider text not null,
  model text not null,
  settings jsonb not null default '{}'::jsonb,
  source_chars integer not null default 0,
  output_count integer not null default 0,
  input_tokens integer,
  output_tokens integer,
  status text not null check (status in ('succeeded','failed')),
  error text,
  created_at timestamptz not null default now()
);
create index if not exists ai_generations_user_idx on public.ai_generations (created_by, created_at desc);

-- ───────────── reusable question bank ─────────────
-- Questions no longer belong to exactly one quiz. quiz_questions links a question to any number of quizzes.
-- questions.quiz_id is kept (nullable) as the quiz a question was originally written for; it no longer decides membership.
alter table public.questions alter column quiz_id drop not null;
alter table public.questions
  add column if not exists course_id uuid references public.courses(id) on delete set null,
  add column if not exists module_id uuid references public.modules(id) on delete set null,
  add column if not exists lesson_id uuid references public.lessons(id) on delete set null,
  add column if not exists source_reference text,
  add column if not exists archived boolean not null default false,
  add column if not exists ai_generation_id uuid references public.ai_generations(id) on delete set null;
create index if not exists questions_lesson_idx on public.questions (lesson_id);
create index if not exists questions_course_idx on public.questions (course_id);

update public.questions q set course_id = z.course_id, lesson_id = coalesce(q.lesson_id, z.lesson_id)
  from public.quizzes z where z.id = q.quiz_id and q.course_id is null;
update public.questions q set module_id = l.module_id from public.lessons l where l.id = q.lesson_id and q.module_id is null;

create table if not exists public.quiz_questions (
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (quiz_id, question_id)
);
create index if not exists quiz_questions_question_idx on public.quiz_questions (question_id);

insert into public.quiz_questions (quiz_id, question_id, position)
select quiz_id, id, position from public.questions where quiz_id is not null
on conflict do nothing;

-- Student functions now read through quiz_questions (still never returning answers before submission).
create or replace function public.get_quiz_for_student(p_quiz uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare q record; result jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into q from public.quizzes where id = p_quiz and status = 'published';
  if not found or not public.is_enrolled(q.course_id) then raise exception 'not available'; end if;

  select jsonb_build_object(
    'quiz', jsonb_build_object('id', q.id, 'title', q.title, 'description', q.description, 'pass_mark', q.pass_mark,
                               'allow_retry', q.allow_retry, 'max_attempts', q.max_attempts, 'show_explanations', q.show_explanations),
    'attempts', (select count(*) from public.quiz_attempts where user_id = auth.uid() and quiz_id = q.id),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', qu.id, 'text', qu.question_text, 'type', qu.question_type, 'points', qu.points,
        'options', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'text', o.option_text) order by o.position), '[]'::jsonb)
                    from public.question_options o where o.question_id = qu.id)
      ) order by qq.position, qu.created_at)
      from public.quiz_questions qq join public.questions qu on qu.id = qq.question_id
      where qq.quiz_id = q.id and qu.published and qu.review_status = 'approved' and not qu.archived), '[]'::jsonb)
  ) into result;
  return result;
end; $$;

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

  return jsonb_build_object('attempt_id', attempt_id, 'score', got, 'max', total, 'percent', pct, 'passed', did_pass,
                            'pass_mark', q.pass_mark, 'can_retry', q.allow_retry and (q.max_attempts is null or attempts + 1 < q.max_attempts), 'review', review);
end; $$;
revoke execute on function public.get_quiz_for_student(uuid), public.submit_quiz(uuid, jsonb) from public, anon;
grant execute on function public.get_quiz_for_student(uuid), public.submit_quiz(uuid, jsonb) to authenticated;

-- ═════════════════════════════════════════ TRIGGERS ═════════════════════════════════════════
do $$ declare t text; begin
  foreach t in array array['site_settings','social_links','page_sections','portfolio_projects','services','seo_metadata','lesson_sources'] loop
    execute format('drop trigger if exists trg_%1$s_updated on public.%1$s', t);
    execute format('create trigger trg_%1$s_updated before update on public.%1$s for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ═════════════════════════════════════════ RLS ═════════════════════════════════════════
alter table public.site_settings      enable row level security;
alter table public.social_links       enable row level security;
alter table public.page_sections      enable row level security;
alter table public.portfolio_projects enable row level security;
alter table public.portfolio_media    enable row level security;
alter table public.services           enable row level security;
alter table public.seo_metadata       enable row level security;
alter table public.contact_messages   enable row level security;
alter table public.activity_logs      enable row level security;
alter table public.ai_generations     enable row level security;
alter table public.quiz_questions     enable row level security;
alter table public.lesson_sources     enable row level security;

-- Public site: read published content only. Admin: everything. Nobody else writes.
drop policy if exists site_settings_read on public.site_settings;
create policy site_settings_read on public.site_settings for select to anon, authenticated using (true);
drop policy if exists site_settings_admin on public.site_settings;
create policy site_settings_admin on public.site_settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists social_links_read on public.social_links;
create policy social_links_read on public.social_links for select to anon, authenticated using (active or public.is_admin());
drop policy if exists social_links_admin on public.social_links;
create policy social_links_admin on public.social_links for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists page_sections_read on public.page_sections;
create policy page_sections_read on public.page_sections for select to anon, authenticated using (status = 'published' or public.is_admin());
drop policy if exists page_sections_admin on public.page_sections;
create policy page_sections_admin on public.page_sections for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists portfolio_read on public.portfolio_projects;
create policy portfolio_read on public.portfolio_projects for select to anon, authenticated using (status = 'published' or public.is_admin());
drop policy if exists portfolio_admin on public.portfolio_projects;
create policy portfolio_admin on public.portfolio_projects for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists portfolio_media_read on public.portfolio_media;
create policy portfolio_media_read on public.portfolio_media for select to anon, authenticated
  using (exists (select 1 from public.portfolio_projects p where p.id = project_id and p.status = 'published') or public.is_admin());
drop policy if exists portfolio_media_admin on public.portfolio_media;
create policy portfolio_media_admin on public.portfolio_media for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists services_read on public.services;
create policy services_read on public.services for select to anon, authenticated using (status = 'published' or public.is_admin());
drop policy if exists services_admin on public.services;
create policy services_admin on public.services for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists seo_read on public.seo_metadata;
create policy seo_read on public.seo_metadata for select to anon, authenticated using (true);
drop policy if exists seo_admin on public.seo_metadata;
create policy seo_admin on public.seo_metadata for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists contact_admin on public.contact_messages;
create policy contact_admin on public.contact_messages for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists activity_admin_read on public.activity_logs;
create policy activity_admin_read on public.activity_logs for select to authenticated using (public.is_admin());
drop policy if exists activity_admin_insert on public.activity_logs;
create policy activity_admin_insert on public.activity_logs for insert to authenticated with check (public.is_admin() and actor_id = auth.uid());

drop policy if exists ai_generations_admin_read on public.ai_generations;
create policy ai_generations_admin_read on public.ai_generations for select to authenticated using (public.is_admin());
drop policy if exists ai_generations_admin_insert on public.ai_generations;
create policy ai_generations_admin_insert on public.ai_generations for insert to authenticated with check (public.is_admin() and created_by = auth.uid());

drop policy if exists lesson_sources_admin on public.lesson_sources;
create policy lesson_sources_admin on public.lesson_sources for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists quiz_questions_admin on public.quiz_questions;
create policy quiz_questions_admin on public.quiz_questions for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ═════════════════════════════════════════ GRANTS ═════════════════════════════════════════
revoke all on public.site_settings, public.social_links, public.page_sections, public.portfolio_projects, public.portfolio_media,
              public.services, public.seo_metadata, public.contact_messages, public.activity_logs, public.ai_generations,
              public.quiz_questions, public.lesson_sources from anon, authenticated;
grant select on public.site_settings, public.social_links, public.page_sections, public.portfolio_projects, public.portfolio_media,
                public.services, public.seo_metadata to anon, authenticated;
-- Writes are still filtered by the admin-only RLS policies above.
grant update on public.site_settings, public.seo_metadata to authenticated;
grant insert, update, delete on public.social_links, public.page_sections, public.portfolio_projects, public.portfolio_media,
                                public.services to authenticated;
grant select, update, delete on public.contact_messages to authenticated;
grant select, insert on public.activity_logs, public.ai_generations to authenticated;
grant select, insert, update, delete on public.quiz_questions, public.lesson_sources to authenticated;

-- ═════════════════════════════════════════ SEED: existing real content ═════════════════════════════════════════
insert into public.page_sections (page, section_key, label, display_order, eyebrow, title, body, image_url, image_alt, cta_label, cta_href, cta2_label, cta2_href, items, settings) values
-- HOME
('home','hero','Hero',10,'3D artist, designer & creative technologist',
 E'Creating worlds.\nDesigning experiences.\nBuilding what''s next.',
 'I''m Samson Odejinmi, exploring the space between visual storytelling and technology.', null, null,
 'Explore my work','/portfolio','Explore Fola Academy','/academy',
 '[{"title":"3D Animation","meta":"Core practice","body":"Objects, cameras and scenes brought to life with *deliberate timing* and movement."},
   {"title":"Environment Design","meta":"Core practice","body":"Spaces with a sense of place, built for *mood, scale and depth*."},
   {"title":"Product Visualisation","meta":"Core practice","body":"Clean, controlled renders that show a product *the way you want it seen*."},
   {"title":"Creative Technology","meta":"Exploring","body":"Where I''m headed: procedural 3D and Python, *still being learned* and said plainly."}]'::jsonb, '{"scene_url":"https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"}'::jsonb),
('home','statement','Statement',20,null,
 'I create visual experiences, and I''m increasingly exploring how technology can extend what creativity can do.', null, null, null, null, null, null, null, '[]'::jsonb, '{}'::jsonb),
('home','selected_work','Selected work',30,null,'Selected work','Drag, or use the arrows. Personal studies are labelled as such.', null, null,
 'All work','/portfolio', null, null, '[]'::jsonb, '{}'::jsonb),
('home','about_preview','About preview',40,null,'Creative by instinct. Technical by curiosity.',
 E'I got interested in 3D and animation around 2020, then trained in 3D Animation and Video Production in Lagos. I care about how things look, and how they''re made.\n\nAlongside the creative work I''m studying Computer Science and exploring Python, procedural 3D and Unreal Engine, with Technical Direction as the long-term goal.',
 '/images/samson-odejinmi.jpg','Portrait of Samson Odejinmi','More about me','/about', null, null, '[]'::jsonb, '{}'::jsonb),
('home','disciplines','Disciplines',50,null,'What I work across', null, null, null, null,'/services', null, null,
 '[{"title":"3D Animation"},{"title":"3D Modelling"},{"title":"Environment Design"},{"title":"Product Visualisation"},{"title":"Product Animation"},{"title":"VFX"},{"title":"Video Editing"},{"title":"Graphic Design"},{"title":"Creative Technology"}]'::jsonb, '{}'::jsonb),
('home','academy','Fola Academy introduction',60,'Fola Academy','Learn the idea. Understand the process.',
 'Fola Academy is where I''m building practical creative education for beginners: structured, patient, and focused on why things work, not only which buttons to press. The first course, Blender Foundations, is in preparation.',
 null, null, 'Visit the Academy','/academy','See courses','/academy/courses',
 '[{"title":"Understand"},{"title":"Practise"},{"title":"Build"},{"title":"Grow"}]'::jsonb, '{"featured_course_slug":""}'::jsonb),
('home','workflow','How a project goes',70,null,'How a project goes',
 '3D animation, environments, product visuals, video and design. Every project follows the same five steps.', null, null,
 'See all services','/services', null, null, '[]'::jsonb, '{}'::jsonb),
('home','exploring','Currently exploring',80,null,'Currently exploring',
 'Not claims of mastery: what I''m learning right now, and why it matters to where I''m headed.', null, null, null, null, null, null,
 '[{"title":"Python","body":"Automating and extending creative workflows."},
   {"title":"Procedural 3D","body":"Building with rules and systems instead of by hand."},
   {"title":"Unreal Engine","body":"Real-time environments and tooling."},
   {"title":"Advanced VFX","body":"Going deeper on effects and integration."},
   {"title":"Technical direction","body":"The long-term direction: connecting creative intent to technical systems."}]'::jsonb, '{}'::jsonb),
('home','contact_cta','Contact call to action',90,null,'Have something in mind? Let''s talk about it.', null, null, null,
 'Get in touch','/contact', null, null, '[]'::jsonb, '{}'::jsonb),
-- ABOUT
('about','intro','Introduction',10,null,'I make visual things, and I''m learning how technology can take them further.',
 'I''m Samson Afolabi Odejinmi, publicly known as Fola. I work in 3D, animation and design, I''m studying Computer Science, and I''m building Fola Academy.',
 '/images/samson-odejinmi.jpg','Portrait of Samson Odejinmi', null, null, null, null, '[]'::jsonb, '{}'::jsonb),
('about','story','Biography',20,null,'How I got into 3D',
 E'My interest in animation and 3D started around 2020. I was drawn to it early, but at that point I had limited access to the resources and equipment needed to pursue it fully.\n\nI later trained in 3D Animation and Video Production at Del-York Creative Academy in Lagos, and took part in physical 3D training with YAPI in Lagos in 2024/2025.\n\nToday my interests run across 3D animation, environment design, product visualisation, product animation, video editing, graphic design and visual storytelling.',
 null, null, null, null, null, null, '[]'::jsonb, '{}'::jsonb),
('about','philosophy','Creative and teaching philosophy',30,null,'How I think about learning',
 E'My approach to teaching is simple: I want learners to understand what they are doing and why it works, rather than simply memorising which buttons to press.\n\nThat idea sits behind Fola Academy, the educational platform I''m developing to make creative and technical skills easier for beginners through practical, structured, beginner-friendly learning.',
 null, null, 'Visit Fola Academy','/academy', null, null, '[]'::jsonb, '{}'::jsonb),
('about','disciplines','Skills (shared with homepage)',40,null,'What I work across', null, null, null, null, null, null, null, '[]'::jsonb, '{}'::jsonb),
('about','exploring','Current focus (shared with homepage)',50,null,'Currently exploring','Still learning, and being clear about it.', null, null, null, null, null, null, '[]'::jsonb, '{}'::jsonb),
('about','timeline','Learning journey',60,null,'The journey so far', null, null, null, null, null, null, null,
 '[{"meta":"Around 2020","title":"Interest in 3D and animation begins","body":"Curious about the field, but with limited access to the resources and equipment needed to pursue it fully."},
   {"meta":"Training","title":"Del-York Creative Academy, Lagos","body":"Trained in 3D Animation and Video Production."},
   {"meta":"2024/2025","title":"YAPI, Lagos","body":"Took part in physical 3D training."},
   {"meta":"Now","title":"Computer Science, University of the People","body":"Studying toward a foundation in computing alongside creative work."},
   {"meta":"Now","title":"Exploring creative technology","body":"Python, procedural 3D, Unreal Engine and advanced VFX, with Technical Direction as the long-term goal."},
   {"meta":"In development","title":"Fola Academy","body":"An educational platform for beginners: practical, structured and focused on understanding."}]'::jsonb, '{}'::jsonb),
('about','narrio','NARRIO STUDIO',70,'Creative Director and Team Lead','NARRIO STUDIO',
 'NARRIO STUDIO is a creative team I lead as Creative Director and Team Lead. It''s a creative initiative, not a company I work for: a group working across 3D, animation, product animation, environment design, advertising, video and visual storytelling.',
 null, null, null, null, null, null, '[]'::jsonb, '{}'::jsonb),
('about','direction','Future direction',80,null,'Where this is going',
 'My long-term goal is Technical Direction: the work of connecting creative intent to the technical systems that make it possible. To get there I''m combining 3D, programming and creative technology, and building the foundations properly.',
 null, null, null, null, null, null, '[]'::jsonb, '{}'::jsonb),
('about','contact_cta','Contact call to action',90,null,'If this sounds like your kind of project, say hello.', null, null, null,
 'Get in touch','/contact', null, null, '[]'::jsonb, '{}'::jsonb),
-- SERVICES PAGE
('services','intro','Introduction',10,null,'Visual work, made with care and a clear process.',
 'Here''s what I can make with you, and how the work usually goes.', null, null, null, null, null, null, '[]'::jsonb, '{}'::jsonb),
('services','process','Process (also on the homepage)',20,null,'How a project goes','Five steps, in order. You always know what happens next.', null, null, null, null, null, null,
 '[{"title":"Understand","body":"We talk through what you need, who it''s for and where it will be seen."},
   {"title":"Plan","body":"I turn that into a clear approach: references, structure and what gets made."},
   {"title":"Build","body":"The model, animation, edit or design is made, with check-ins along the way."},
   {"title":"Refine","body":"We look at it together and I adjust until it''s right."},
   {"title":"Deliver","body":"Final files in the formats you need, ready to use."}]'::jsonb, '{}'::jsonb),
('services','cta','Call to action',30,null,'Tell me what you''re making.', null, null, null, 'Start a conversation','/contact', null, null, '[]'::jsonb, '{}'::jsonb),
-- CONTACT PAGE
('contact','intro','Introduction',10,null,'Let''s talk about your project.',
 'A few lines about what you''re making is enough to start. I''ll reply by email.', null, null, null, null, null, null, '[]'::jsonb, '{}'::jsonb),
-- PORTFOLIO PAGE
('portfolio','intro','Introduction',10,null,'Work','3D, animation and design. Personal studies are labelled as such.', null, null, null, null, null, null, '[]'::jsonb, '{}'::jsonb)
on conflict (page, section_key) do nothing;

insert into public.services (slug, name, short_description, deliverables, tools, related_category, display_order, status) values
('3d-animation','3D Animation','Characters, objects and cameras brought to life with deliberate timing and movement.',
 array['Storyboarding the idea and the shots','Animating objects, cameras and scenes','Timing, pacing and polish'], array['Blender'], '3D Animation', 10, 'published'),
('environment-design','Environment Design','Spaces with a sense of place, built for mood, scale and depth.',
 array['Gathering reference and defining the mood','Modelling and dressing the space','Lighting and composing the final frames'], array['Blender'], 'Environment Design', 20, 'published'),
('product-visualisation','Product Visualisation','Clean, controlled renders that show a product the way you want it seen.',
 array['Modelling the product accurately','Materials, lighting and camera setup','Final stills for web, print or social'], array['Blender'], 'Product Visualisation', 30, 'published'),
('product-animation','Product Animation','Short animated sequences that explain, reveal or showcase a product.',
 array['Planning the sequence and camera moves','Animating the product and scene','Rendering and delivery in the formats you need'], array['Blender'], 'Product Animation', 40, 'published'),
('vfx','VFX','Visual effects that support a story rather than distract from it.',
 array['Understanding the shot and what the effect needs to do','Building and integrating the effect','Refining until it sits naturally in the footage'], '{}', 'VFX', 50, 'published'),
('video-editing','Video Editing','Footage shaped into something clear, paced and watchable.',
 array['Structuring the story and the cut','Pacing, sound and transitions','Final export for the platform it''s going to'], '{}', 'Video', 60, 'published'),
('creative-design','Creative Design','Graphic design that supports a visual idea: layouts, assets and supporting material.',
 array['Understanding the message and the audience','Designing layouts and visual assets','Preparing files for their final use'], '{}', 'Graphic Design', 70, 'published'),
('creative-technology','Creative Technology','Where I''m headed: procedural 3D, scripting and tools that extend what a creative workflow can do. This is an area I''m actively developing.',
 array['Exploring procedural approaches in 3D','Using Python to automate and extend creative work','Prototyping ideas where visuals and code meet'], array['Blender','Python (exploring)','Unreal Engine (exploring)'], null, 80, 'published')
on conflict (slug) do nothing;

-- The four existing portfolio entries are clearly labelled PLACEHOLDERS (not real projects). They're kept published so the
-- site looks the same until real work replaces them. Archive or edit them in Admin → Website → Portfolio.
insert into public.portfolio_projects (slug, title, short_description, description, category, categories, project_status, is_placeholder, featured, display_order, status) values
('product-scene-placeholder','Product scene','A lit, composed product render.','Placeholder entry. Replace it with a real project in Admin → Website → Portfolio.','Product Visualisation', array['Product Visualisation'], 'Placeholder', true, true, 10, 'published'),
('environment-placeholder','Environment study','A space built for mood and depth.','Placeholder entry. Replace it with a real project in Admin → Website → Portfolio.','Environment Design', array['Environment Design'], 'Placeholder', true, true, 20, 'published'),
('animation-placeholder','Animation test','Motion, timing and camera.','Placeholder entry. Replace it with a real project in Admin → Website → Portfolio.','3D Animation', array['3D Animation'], 'Placeholder', true, true, 30, 'published'),
('vfx-placeholder','VFX exploration','Effects and compositing experiments.','Placeholder entry. Replace it with a real project in Admin → Website → Portfolio.','VFX', array['VFX'], 'Placeholder', true, true, 40, 'published')
on conflict (slug) do nothing;
