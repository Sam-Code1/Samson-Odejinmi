-- Fola Academy 0002: admin CMS, quizzes, payments, certificates, media, settings.
-- Run AFTER 0001_init.sql in the Supabase SQL editor.
-- IDEMPOTENT: safe on a fresh database AND after a partial earlier run (every create is guarded or preceded by a drop-if-exists).
-- Extends existing tables (no duplicates). Students never read quiz answers directly:
-- quizzes are fetched and scored through security-definer functions.

-- ───────────────────────── profiles: email + last activity ─────────────────────────
alter table public.profiles
  add column if not exists email text,
  add column if not exists last_active_at timestamptz;

update public.profiles p set email = u.email from auth.users u where u.id = p.id and p.email is null;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, last_name, email)
  values (new.id,
          left(coalesce(new.raw_user_meta_data->>'first_name',''), 80),
          left(coalesce(new.raw_user_meta_data->>'last_name',''), 80),
          new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end; $$;

create index if not exists profiles_email_idx on public.profiles (lower(email));

-- ───────────────────────── courses ─────────────────────────
-- Reused existing columns: title, slug, subtitle (= short description), description (= full description),
-- level (= difficulty), status.
alter table public.courses
  add column if not exists image_url text,
  add column if not exists thumbnail_url text,
  add column if not exists instructor text default 'Samson Odejinmi',
  add column if not exists category text,
  add column if not exists estimated_duration text,
  add column if not exists objectives text[] not null default '{}',
  add column if not exists learning_outcomes text[] not null default '{}',
  add column if not exists requirements text[] not null default '{}',
  add column if not exists target_audience text[] not null default '{}',
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists certificate_enabled boolean not null default false,
  add column if not exists published_at timestamptz;

create or replace function public.trg_course_publish_stamp() returns trigger
language plpgsql as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end; $$;
drop trigger if exists courses_publish_stamp on public.courses;
create trigger courses_publish_stamp before insert or update on public.courses for each row execute function public.trg_course_publish_stamp();

-- ───────────────────────── ordering: allow safe reordering ─────────────────────────
alter table public.modules drop constraint if exists modules_course_id_position_key;
alter table public.modules drop constraint if exists modules_course_position_key;
alter table public.modules add constraint modules_course_position_key unique (course_id, position) deferrable initially deferred;
alter table public.lessons drop constraint if exists lessons_module_id_position_key;
alter table public.lessons drop constraint if exists lessons_module_position_key;
alter table public.lessons add constraint lessons_module_position_key unique (module_id, position) deferrable initially deferred;

-- ───────────────────────── lessons: type, provider-agnostic video ─────────────────────────
alter table public.lessons
  add column if not exists lesson_type text not null default 'video',
  add column if not exists video_thumbnail text,
  add column if not exists video_enabled boolean not null default true;

alter table public.lessons drop constraint if exists lessons_lesson_type_check;
alter table public.lessons add constraint lessons_lesson_type_check check (lesson_type in ('video','text','mixed'));

update public.lessons set video_provider = 'none', video_id = null where video_provider = 'vimeo';
alter table public.lessons drop constraint if exists lessons_video_provider_check;
alter table public.lessons add constraint lessons_video_provider_check check (video_provider in ('none','youtube','bunny','mux','cloudflare'));
-- Defence in depth: only a bare 11-character YouTube id is ever stored, never a URL or embed HTML.
alter table public.lessons drop constraint if exists lessons_youtube_id_check;
alter table public.lessons add constraint lessons_youtube_id_check check (video_provider <> 'youtube' or video_id is null or video_id ~ '^[A-Za-z0-9_-]{11}$');
-- There is deliberately NO download flag for video.

-- ───────────────────────── enrolments: statuses + access ─────────────────────────
alter table public.enrolments drop constraint if exists enrolments_status_check;
update public.enrolments set status = 'cancelled' where status = 'revoked';
alter table public.enrolments add constraint enrolments_status_check check (status in ('active','completed','cancelled','refunded','pending'));

create or replace function public.is_enrolled(p_course uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.enrolments e
                 where e.user_id = auth.uid() and e.course_id = p_course and e.status in ('active','completed'));
$$;

-- ───────────────────────── quizzes ─────────────────────────
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete set null,
  title text not null,
  description text,
  pass_mark integer not null default 70 check (pass_mark between 0 and 100),
  allow_retry boolean not null default true,
  max_attempts integer check (max_attempts is null or max_attempts > 0),
  show_explanations boolean not null default true,
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists quizzes_course_idx on public.quizzes (course_id);
create index if not exists quizzes_lesson_idx on public.quizzes (lesson_id);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  question_text text not null,
  question_type text not null default 'multiple_choice' check (question_type in ('multiple_choice','true_false','multiple_select')),
  explanation text,
  points integer not null default 1 check (points > 0),
  difficulty text check (difficulty is null or difficulty in ('easy','medium','hard')),
  position integer not null default 0,
  -- Review workflow. AI output enters as 'ai_generated' and is NEVER visible to students until approved AND published.
  source text not null default 'manual' check (source in ('manual','ai')),
  review_status text not null default 'draft' check (review_status in ('draft','ai_generated','approved','rejected')),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questions_publish_requires_approval check (not published or review_status = 'approved')
);
create index if not exists questions_quiz_idx on public.questions (quiz_id);

create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  option_text text not null,
  is_correct boolean not null default false,
  position integer not null default 0
);
create index if not exists question_options_q_idx on public.question_options (question_id);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  score_points integer not null default 0,
  max_points integer not null default 0,
  percent numeric(5,1) not null default 0,
  passed boolean not null default false,
  submitted_at timestamptz not null default now()
);
create index if not exists quiz_attempts_user_idx on public.quiz_attempts (user_id, quiz_id);

create table if not exists public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts(id) on delete cascade,
  question_id uuid references public.questions(id) on delete set null,
  selected_option_ids uuid[] not null default '{}',
  is_correct boolean not null default false,
  points_awarded integer not null default 0
);
create index if not exists quiz_answers_attempt_idx on public.quiz_answers (attempt_id);

-- ───────────────────────── resources: generalised ─────────────────────────
alter table public.lesson_resources
  add column if not exists description text,
  add column if not exists module_id uuid references public.modules(id) on delete cascade,
  add column if not exists quiz_id uuid references public.quizzes(id) on delete cascade,
  add column if not exists file_path text,
  add column if not exists size_bytes bigint,
  add column if not exists mime_type text,
  add column if not exists download_enabled boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();
update public.lesson_resources set kind = 'other' where kind = 'file';
alter table public.lesson_resources drop constraint if exists lesson_resources_kind_check;
alter table public.lesson_resources add constraint lesson_resources_kind_check check (kind in ('pdf','zip','doc','xlsx','image','link','other'));

-- ───────────────────────── media, payments, certificates, settings ─────────────────────────
create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  bucket text not null,
  path text not null,
  public_url text,
  filename text not null,
  mime_type text,
  size_bytes bigint,
  kind text not null default 'image' check (kind in ('image','thumbnail','lesson_image','document','video_meta')),
  course_id uuid references public.courses(id) on delete set null,
  lesson_id uuid references public.lessons(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Written only by trusted server code (payment webhook / verification). Never by the browser.
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  course_id uuid references public.courses(id) on delete set null,
  reference text not null unique,
  amount_minor integer not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  provider text not null default 'paystack',
  status text not null default 'pending' check (status in ('pending','successful','failed','refunded')),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists payments_user_idx on public.payments (user_id);
create index if not exists payments_status_idx on public.payments (status, created_at desc);

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  certificate_number text not null unique,
  issued_at timestamptz not null default now(),
  completed_at timestamptz,
  revoked boolean not null default false,
  unique (user_id, course_id)
);

create table if not exists public.academy_settings (
  id boolean primary key default true check (id),
  academy_name text not null default 'Fola Academy',
  description text,
  support_email text,
  default_currency text not null default 'NGN' check (default_currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'Africa/Lagos',
  default_video_provider text not null default 'youtube' check (default_video_provider in ('youtube','bunny','mux','cloudflare')),
  updated_at timestamptz not null default now()
);
insert into public.academy_settings (id) values (true) on conflict do nothing;

-- updated_at triggers
do $$ declare t text; begin
  foreach t in array array['quizzes','questions','lesson_resources','academy_settings'] loop
    execute format('drop trigger if exists trg_%1$s_updated on public.%1$s', t);
    execute format('create trigger trg_%1$s_updated before update on public.%1$s for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ───────────────────────── relations to profiles (lets the admin join students to their records) ─────────────────────────
insert into public.profiles (id, email) select id, email from auth.users on conflict (id) do nothing;
do $$
declare r record;
begin
  for r in select * from (values
    ('enrolments',      'enrolments_profile_fk',      'cascade'),
    ('payments',        'payments_profile_fk',        'set null'),
    ('certificates',    'certificates_profile_fk',    'cascade'),
    ('quiz_attempts',   'quiz_attempts_profile_fk',   'cascade'),
    ('lesson_progress', 'lesson_progress_profile_fk', 'cascade'),
    ('course_progress', 'course_progress_profile_fk', 'cascade')
  ) as t(tbl, cname, act) loop
    if not exists (select 1 from pg_constraint where conname = r.cname and conrelid = ('public.' || r.tbl)::regclass) then
      execute format('alter table public.%I add constraint %I foreign key (user_id) references public.profiles(id) on delete %s', r.tbl, r.cname, r.act);
    end if;
  end loop;
end $$;

-- ───────────────────────── progress: completion, certificate, activity ─────────────────────────
create or replace function public.recompute_course_progress(p_user uuid, p_course uuid) returns void
language plpgsql security definer set search_path = public as $$
declare total int; done int; last_l uuid; cert_on boolean;
begin
  select count(*) into total from public.lessons where course_id = p_course and status = 'published';
  select count(*) into done from public.lesson_progress lp join public.lessons l on l.id = lp.lesson_id
    where lp.user_id = p_user and lp.course_id = p_course and lp.completed and l.status = 'published';
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

-- ───────────────────────── RLS: new tables ─────────────────────────
alter table public.quizzes          enable row level security;
alter table public.questions        enable row level security;
alter table public.question_options enable row level security;
alter table public.quiz_attempts    enable row level security;
alter table public.quiz_answers     enable row level security;
alter table public.media_assets     enable row level security;
alter table public.payments         enable row level security;
alter table public.certificates     enable row level security;
alter table public.academy_settings enable row level security;

-- Students see quiz METADATA for published quizzes in courses they're enrolled in. Never questions/options/answers.
drop policy if exists quizzes_read on public.quizzes;
create policy quizzes_read on public.quizzes for select to authenticated using ((status = 'published' and public.is_enrolled(course_id)) or public.is_admin());
drop policy if exists quizzes_admin_write on public.quizzes;
create policy quizzes_admin_write on public.quizzes for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists questions_admin_all on public.questions;
create policy questions_admin_all on public.questions for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists options_admin_all on public.question_options;
create policy options_admin_all on public.question_options for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists attempts_select_own on public.quiz_attempts;
create policy attempts_select_own on public.quiz_attempts for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists answers_select_own on public.quiz_answers;
create policy answers_select_own on public.quiz_answers for select to authenticated
  using (exists (select 1 from public.quiz_attempts a where a.id = attempt_id and (a.user_id = auth.uid() or public.is_admin())));

drop policy if exists admin_users_admin_read on public.admin_users;
create policy admin_users_admin_read on public.admin_users for select to authenticated using (public.is_admin());
drop policy if exists media_admin_all on public.media_assets;
create policy media_admin_all on public.media_assets for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists payments_select_own on public.payments;
create policy payments_select_own on public.payments for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists certificates_select_own on public.certificates;
create policy certificates_select_own on public.certificates for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists certificates_admin_update on public.certificates;
create policy certificates_admin_update on public.certificates for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists settings_admin_all on public.academy_settings;
create policy settings_admin_all on public.academy_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Lessons contain the video reference, so they are readable ONLY by enrolled students and admins (never anonymously).
-- Titles for the public curriculum come from public_course_curriculum(), which returns titles only.
drop policy if exists lessons_read on public.lessons;
create policy lessons_read on public.lessons for select to authenticated using ((status = 'published' and public.is_enrolled(course_id)) or public.is_admin());
revoke select on public.lessons from anon;

-- Resources: enrolled students may READ the row; admins manage.
drop policy if exists resources_read on public.lesson_resources;
create policy resources_read on public.lesson_resources for select to authenticated using (public.is_enrolled(course_id) or public.is_admin());

-- ───────────────────────── grants ─────────────────────────
revoke all on public.quizzes, public.questions, public.question_options, public.quiz_attempts, public.quiz_answers,
              public.media_assets, public.payments, public.certificates, public.academy_settings from anon, authenticated;
grant select, insert, update, delete on public.quizzes, public.questions, public.question_options, public.media_assets, public.academy_settings to authenticated; -- RLS: admin writes only
grant select on public.quiz_attempts, public.quiz_answers, public.payments to authenticated;
grant select, update on public.certificates to authenticated;
grant select on public.quizzes to authenticated;

-- ───────────────────────── functions: student quiz ─────────────────────────
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
      ) order by qu.position, qu.created_at)
      from public.questions qu
      where qu.quiz_id = q.id and qu.published and qu.review_status = 'approved'), '[]'::jsonb)
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

  for qu in select * from public.questions where quiz_id = q.id and published and review_status = 'approved' order by position, created_at loop
    select coalesce(array_agg(o.id), '{}') into correct from public.question_options o where o.question_id = qu.id and o.is_correct;
    select coalesce(array_agg(t.val::uuid), '{}') into sel from jsonb_array_elements_text(coalesce(p_answers -> qu.id::text, '[]'::jsonb)) as t(val)
      where t.val::uuid in (select id from public.question_options where question_id = qu.id);
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

-- ───────────────────────── functions: public curriculum + certificate check ─────────────────────────
-- Titles only. No video, text or resources are ever returned.
create or replace function public.public_course_curriculum(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('position', m.position, 'title', m.title,
           'lessons', (select coalesce(jsonb_agg(jsonb_build_object('title', l.title) order by l.position), '[]'::jsonb)
                       from public.lessons l where l.module_id = m.id and l.status = 'published'))
         order by m.position), '[]'::jsonb)
  from public.modules m join public.courses c on c.id = m.course_id
  where c.slug = p_slug and c.status = 'published';
$$;
grant execute on function public.public_course_curriculum(text) to anon, authenticated;

create or replace function public.verify_certificate(p_number text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('valid', not ce.revoked, 'student_name', trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')),
                            'course', c.title, 'issued_at', ce.issued_at, 'completed_at', ce.completed_at)
  from public.certificates ce join public.courses c on c.id = ce.course_id left join public.profiles p on p.id = ce.user_id
  where ce.certificate_number = upper(trim(p_number));
$$;
grant execute on function public.verify_certificate(text) to anon, authenticated;

-- ───────────────────────── functions: admin ─────────────────────────
create or replace function public.reorder_modules(p_course uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorised'; end if;
  update public.modules m set position = x.ord
    from (select id, ord from unnest(p_ids) with ordinality as t(id, ord)) x where m.id = x.id and m.course_id = p_course;
end; $$;

create or replace function public.reorder_lessons(p_module uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorised'; end if;
  update public.lessons l set position = x.ord
    from (select id, ord from unnest(p_ids) with ordinality as t(id, ord)) x where l.id = x.id and l.module_id = p_module;
end; $$;

create or replace function public.move_lesson_to_module(p_lesson uuid, p_module uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cid uuid; mcid uuid; nextpos int;
begin
  if not public.is_admin() then raise exception 'not authorised'; end if;
  select course_id into cid from public.lessons where id = p_lesson;
  select course_id into mcid from public.modules where id = p_module;
  if cid is null or mcid is distinct from cid then raise exception 'module must belong to the same course'; end if;
  select coalesce(max(position), 0) + 1 into nextpos from public.lessons where module_id = p_module;
  update public.lessons set module_id = p_module, position = nextpos where id = p_lesson;
end; $$;

create or replace function public.admin_dashboard_stats() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not authorised'; end if;
  return jsonb_build_object(
    'students', (select count(*) from public.profiles),
    'active_enrolments', (select count(*) from public.enrolments where status in ('active','completed')),
    'published_courses', (select count(*) from public.courses where status = 'published'),
    'draft_courses', (select count(*) from public.courses where status = 'draft'),
    'lessons', (select count(*) from public.lessons),
    'quiz_attempts', (select count(*) from public.quiz_attempts),
    'revenue', coalesce((select jsonb_object_agg(currency, total) from
                (select currency, sum(amount_minor) as total from public.payments where status = 'successful' group by currency) r), '{}'::jsonb)
  );
end; $$;

revoke execute on function public.get_quiz_for_student(uuid), public.submit_quiz(uuid, jsonb), public.reorder_modules(uuid, uuid[]),
      public.reorder_lessons(uuid, uuid[]), public.move_lesson_to_module(uuid, uuid), public.admin_dashboard_stats() from public, anon;
grant execute on function public.get_quiz_for_student(uuid), public.submit_quiz(uuid, jsonb), public.reorder_modules(uuid, uuid[]),
      public.reorder_lessons(uuid, uuid[]), public.move_lesson_to_module(uuid, uuid), public.admin_dashboard_stats() to authenticated;

-- ───────────────────────── storage buckets ─────────────────────────
-- academy-media: public images (course covers, thumbnails). course-resources: PRIVATE downloadable files,
-- served to enrolled students through short-lived signed URLs only.
insert into storage.buckets (id, name, public) values ('academy-media', 'academy-media', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('course-resources', 'course-resources', false) on conflict (id) do nothing;

drop policy if exists "admin manage academy files" on storage.objects;
create policy "admin manage academy files" on storage.objects for all to authenticated
  using (bucket_id in ('academy-media', 'course-resources') and public.is_admin())
  with check (bucket_id in ('academy-media', 'course-resources') and public.is_admin());

drop policy if exists "public read academy media" on storage.objects;
create policy "public read academy media" on storage.objects for select to anon, authenticated using (bucket_id = 'academy-media');
