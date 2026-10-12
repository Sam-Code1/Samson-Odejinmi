-- READ-ONLY. Shows which parts of migration 0003_website_cms.sql are present. Safe to run any time.
select t.name as table_name, (to_regclass('public.' || t.name) is not null) as present
from (values ('site_settings'),('social_links'),('page_sections'),('portfolio_projects'),('portfolio_media'),('services'),('seo_metadata'),
             ('contact_messages'),('activity_logs'),('ai_generations'),('quiz_questions'),('lesson_sources')) as t(name)
union all
select 'modules.status column', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'modules' and column_name = 'status')
union all
select 'questions.archived column', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'questions' and column_name = 'archived')
union all
select 'submit_contact_message() function', exists (select 1 from pg_proc where proname = 'submit_contact_message');
