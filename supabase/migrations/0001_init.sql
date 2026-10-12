-- Fola Academy: core schema, Row Level Security and progress tracking.
-- Run in the Supabase SQL editor (or `supabase db push`). Then run supabase/seed.sql.
-- Authorisation is enforced here, in Postgres, not in the frontend.

create extension if not exists pgcrypto;

-- ───────────────────────── helpers ─────────────────────────
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;

-- ───────────────────────── tables ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name  text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  description text,
  level text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Amounts are minor units (kobo / cents). Add currencies by adding rows, not columns.
create table public.course_pricing (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor integer not null check (amount_minor >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, currency)
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  position integer not null,
  title text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, position)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  slug text not null,
  position integer not null,
  title text not null,
  summary text,
  content_md text,
  -- Provider-agnostic video reference. Bunny ids are "libraryId/videoId".
  video_provider text not null default 'none' check (video_provider in ('none','youtube','vimeo','bunny')),
  video_id text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  is_preview boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, slug),
  unique (module_id, position)
);
create index lessons_course_idx on public.lessons (course_id);

create table public.lesson_resources (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade, -- null = course-level resource
  title text not null,
  kind text not null default 'link' check (kind in ('pdf','link','file')),
  url text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- Enrolments are granted server-side (admin / payment webhook), never by the student.
create table public.enrolments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  status text not null default 'active' check (status in ('active','pending','revoked')),
  source text not null default 'manual' check (source in ('manual','paystack','gift')),
  granted_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  last_position_seconds integer not null default 0 check (last_position_seconds >= 0),
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);
create index lesson_progress_user_course_idx on public.lesson_progress (user_id, course_id);

-- Maintained by trigger; students can read it but never write it.
create table public.course_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  completed_lessons integer not null default 0,
  total_lessons integer not null default 0,
  percent numeric(5,1) not null default 0,
  last_lesson_id uuid references public.lessons(id) on delete set null,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id)
);

-- Future (not created yet): quizzes, questions, question_options, quiz_attempts,
-- quiz_answers, payments, certificates. AI-generated questions must go through
-- draft → human review → approved → published; students only ever see approved content.

-- ───────────────────────── triggers ─────────────────────────
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger trg_courses_updated before update on public.courses for each row execute function public.set_updated_at();
create trigger trg_pricing_updated before update on public.course_pricing for each row execute function public.set_updated_at();
create trigger trg_modules_updated before update on public.modules for each row execute function public.set_updated_at();
create trigger trg_lessons_updated before update on public.lessons for each row execute function public.set_updated_at();
create trigger trg_progress_updated before update on public.lesson_progress for each row execute function public.set_updated_at();

-- Create a profile whenever an auth user is created. No enrolment is granted.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (new.id, left(coalesce(new.raw_user_meta_data->>'first_name',''), 80), left(coalesce(new.raw_user_meta_data->>'last_name',''), 80))
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ───────────────────────── authorisation helpers ─────────────────────────
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

create or replace function public.is_enrolled(p_course uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.enrolments e where e.user_id = auth.uid() and e.course_id = p_course and e.status = 'active');
$$;

-- ───────────────────────── progress maintenance ─────────────────────────
create or replace function public.recompute_course_progress(p_user uuid, p_course uuid) returns void
language plpgsql security definer set search_path = public as $$
declare total int; done int; last_l uuid;
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
    last_lesson_id = excluded.last_lesson_id, completed_at = excluded.completed_at, updated_at = now();
end; $$;
revoke all on function public.recompute_course_progress(uuid, uuid) from public, anon, authenticated;

create or replace function public.trg_lesson_progress_recompute() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.recompute_course_progress(new.user_id, new.course_id);
  return new;
end; $$;

create trigger lesson_progress_recompute after insert or update on public.lesson_progress
  for each row execute function public.trg_lesson_progress_recompute();

-- Keep completed_at honest and server-set.
create or replace function public.trg_lesson_progress_stamp() returns trigger
language plpgsql as $$
begin
  if new.completed and (tg_op = 'INSERT' or not old.completed) then new.completed_at = now();
  elsif not new.completed then new.completed_at = null; end if;
  return new;
end; $$;
create trigger lesson_progress_stamp before insert or update on public.lesson_progress
  for each row execute function public.trg_lesson_progress_stamp();

-- ───────────────────────── Row Level Security ─────────────────────────
alter table public.profiles         enable row level security;
alter table public.admin_users      enable row level security;
alter table public.courses          enable row level security;
alter table public.course_pricing   enable row level security;
alter table public.modules          enable row level security;
alter table public.lessons          enable row level security;
alter table public.lesson_resources enable row level security;
alter table public.enrolments       enable row level security;
alter table public.lesson_progress  enable row level security;
alter table public.course_progress  enable row level security;

-- profiles: own row only. Inserts happen via trigger.
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- admin_users: you can see your own row; nobody can write from the client.
create policy admin_users_select_own on public.admin_users for select to authenticated using (user_id = auth.uid());

-- courses + pricing: public catalogue of published courses.
create policy courses_public_read on public.courses for select to anon, authenticated using (status = 'published' or public.is_admin());
create policy courses_admin_write on public.courses for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy pricing_public_read on public.course_pricing for select to anon, authenticated
  using ((active and exists (select 1 from public.courses c where c.id = course_id and c.status = 'published')) or public.is_admin());
create policy pricing_admin_write on public.course_pricing for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- modules / lessons / resources: enrolled students only (plus free-preview lessons).
create policy modules_read on public.modules for select to authenticated using (public.is_enrolled(course_id) or public.is_admin());
create policy modules_admin_write on public.modules for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy lessons_read on public.lessons for select to anon, authenticated
  using ((status = 'published' and (is_preview or public.is_enrolled(course_id))) or public.is_admin());
create policy lessons_admin_write on public.lessons for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy resources_read on public.lesson_resources for select to authenticated using (public.is_enrolled(course_id) or public.is_admin());
create policy resources_admin_write on public.lesson_resources for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- enrolments: students can read their own. No client writes at all.
create policy enrolments_select_own on public.enrolments for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy enrolments_admin_write on public.enrolments for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- lesson_progress: own rows, only for courses you're enrolled in, and the lesson must belong to that course.
create policy progress_select_own on public.lesson_progress for select to authenticated using (user_id = auth.uid());
create policy progress_insert_own on public.lesson_progress for insert to authenticated
  with check (user_id = auth.uid() and public.is_enrolled(course_id)
              and exists (select 1 from public.lessons l where l.id = lesson_id and l.course_id = lesson_progress.course_id));
create policy progress_update_own on public.lesson_progress for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_enrolled(course_id)
              and exists (select 1 from public.lessons l where l.id = lesson_id and l.course_id = lesson_progress.course_id));

-- course_progress: read-only for students (written by trigger).
create policy course_progress_select_own on public.course_progress for select to authenticated using (user_id = auth.uid());

-- ───────────────────────── grants ─────────────────────────
revoke all on all tables in schema public from anon, authenticated;
grant select on public.courses, public.course_pricing, public.lessons to anon;
grant select on public.courses, public.course_pricing, public.modules, public.lessons, public.lesson_resources,
                public.enrolments, public.course_progress, public.admin_users, public.profiles to authenticated;
grant update (first_name, last_name) on public.profiles to authenticated;
grant insert, update on public.lesson_progress to authenticated;
grant select on public.lesson_progress to authenticated;
-- Admin writes go through RLS policies above (is_admin()):
grant insert, update, delete on public.courses, public.course_pricing, public.modules, public.lessons,
                                public.lesson_resources, public.enrolments to authenticated;
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.is_enrolled(uuid) to anon, authenticated;
