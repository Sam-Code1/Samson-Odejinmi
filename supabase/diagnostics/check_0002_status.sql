-- READ-ONLY status check for migration 0002. Changes nothing.
-- Paste into the Supabase SQL Editor and Run. Rows with present = false are what is MISSING
-- (they sort to the top). If everything is true, 0002 is fully applied.

with
dep_tables(name) as (values
    ('profiles'),
    ('admin_users'),
    ('courses'),
    ('course_pricing'),
    ('modules'),
    ('lessons'),
    ('lesson_resources'),
    ('enrolments'),
    ('lesson_progress'),
    ('course_progress')),
new_tables(name) as (values
    ('academy_settings'),
    ('certificates'),
    ('media_assets'),
    ('payments'),
    ('question_options'),
    ('questions'),
    ('quiz_answers'),
    ('quiz_attempts'),
    ('quizzes')),
new_columns(tbl, col) as (values
    ('profiles', 'email'),
    ('profiles', 'last_active_at'),
    ('courses', 'image_url'),
    ('courses', 'thumbnail_url'),
    ('courses', 'instructor'),
    ('courses', 'category'),
    ('courses', 'estimated_duration'),
    ('courses', 'objectives'),
    ('courses', 'learning_outcomes'),
    ('courses', 'requirements'),
    ('courses', 'target_audience'),
    ('courses', 'seo_title'),
    ('courses', 'seo_description'),
    ('courses', 'certificate_enabled'),
    ('courses', 'published_at'),
    ('lessons', 'lesson_type'),
    ('lessons', 'video_thumbnail'),
    ('lessons', 'video_enabled'),
    ('lesson_resources', 'description'),
    ('lesson_resources', 'module_id'),
    ('lesson_resources', 'quiz_id'),
    ('lesson_resources', 'file_path'),
    ('lesson_resources', 'size_bytes'),
    ('lesson_resources', 'mime_type'),
    ('lesson_resources', 'download_enabled'),
    ('lesson_resources', 'updated_at')),
funcs(name) as (values
    ('handle_new_user'),
    ('trg_course_publish_stamp'),
    ('is_enrolled'),
    ('recompute_course_progress'),
    ('get_quiz_for_student'),
    ('submit_quiz'),
    ('public_course_curriculum'),
    ('verify_certificate'),
    ('reorder_modules'),
    ('reorder_lessons'),
    ('move_lesson_to_module'),
    ('admin_dashboard_stats'),
    ('is_admin'),
    ('set_updated_at')),
cons(name) as (values
    ('modules_course_position_key'),
    ('lessons_module_position_key'),
    ('lessons_lesson_type_check'),
    ('lessons_video_provider_check'),
    ('lessons_youtube_id_check'),
    ('enrolments_status_check'),
    ('lesson_resources_kind_check'),
    ('enrolments_profile_fk'),
    ('payments_profile_fk'),
    ('certificates_profile_fk'),
    ('quiz_attempts_profile_fk'),
    ('lesson_progress_profile_fk'),
    ('course_progress_profile_fk')),
trigs(name) as (values
    ('courses_publish_stamp'),
    ('trg_quizzes_updated'),
    ('trg_questions_updated'),
    ('trg_lesson_resources_updated'),
    ('trg_academy_settings_updated')),
pols(tbl, name) as (values
    ('quizzes', 'quizzes_read'),
    ('quizzes', 'quizzes_admin_write'),
    ('questions', 'questions_admin_all'),
    ('question_options', 'options_admin_all'),
    ('quiz_attempts', 'attempts_select_own'),
    ('quiz_answers', 'answers_select_own'),
    ('admin_users', 'admin_users_admin_read'),
    ('media_assets', 'media_admin_all'),
    ('payments', 'payments_select_own'),
    ('certificates', 'certificates_select_own'),
    ('certificates', 'certificates_admin_update'),
    ('academy_settings', 'settings_admin_all'),
    ('lessons', 'lessons_read'),
    ('lesson_resources', 'resources_read')),
buckets(name) as (values ('academy-media'), ('course-resources'))

select 'A. needs 0001 (existing table)' as step, name as object, to_regclass('public.' || name) is not null as present from dep_tables
union all select 'B. created by 0002 (table)', name, to_regclass('public.' || name) is not null from new_tables
union all select 'C. added by 0002 (column)', tbl || '.' || col,
       exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = t.tbl and c.column_name = t.col) from new_columns t
union all select 'D. function', name,
       exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = f.name) from funcs f
union all select 'E. constraint', name, exists (select 1 from pg_constraint k where k.conname = c.name) from cons c
union all select 'F. trigger', name, exists (select 1 from pg_trigger g where g.tgname = t.name and not g.tgisinternal) from trigs t
union all select 'G. RLS policy', tbl || '.' || name, exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = x.tbl and p.policyname = x.name) from pols x
union all select 'H. storage bucket', name, exists (select 1 from storage.buckets b where b.id = x.name) from buckets x
union all select 'I. admin access data', 'admin_users has at least one row', (select count(*) from public.admin_users) > 0
union all select 'I. admin access data', 'an admin row matches a real auth user', exists (select 1 from public.admin_users a join auth.users u on u.id = a.user_id)
union all select 'E. constraint (new definition)', 'enrolments_status_check allows ''completed''',
       exists (select 1 from pg_constraint k where k.conname = 'enrolments_status_check' and pg_get_constraintdef(k.oid) like '%completed%')
union all select 'E. constraint (new definition)', 'lessons_video_provider_check allows ''mux''',
       exists (select 1 from pg_constraint k where k.conname = 'lessons_video_provider_check' and pg_get_constraintdef(k.oid) like '%mux%')
union all select 'E. constraint (new definition)', 'lesson_resources_kind_check allows ''zip''',
       exists (select 1 from pg_constraint k where k.conname = 'lesson_resources_kind_check' and pg_get_constraintdef(k.oid) like '%zip%')
order by 3, 1, 2;
