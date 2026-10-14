-- 0006: Batch 2 AI layer. Extends the existing ai_generations log (no parallel table) to cover the student tutor,
-- public Academy chatbot and admin lesson assistant; adds learning objectives to questions.
-- Run AFTER 0001–0005. IDEMPOTENT and NON-DESTRUCTIVE.
--
-- Privacy: only request METADATA is logged (who/what/when/model/tokens/duration/status). Message text is never stored.

alter table public.ai_generations
  add column if not exists actor_type text not null default 'admin',
  add column if not exists actor_key text,          -- salted hash of the visitor IP for public chatbot rate limiting; never the raw IP
  add column if not exists duration_ms integer;

alter table public.ai_generations drop constraint if exists ai_generations_kind_check;
alter table public.ai_generations add constraint ai_generations_kind_check
  check (kind in ('quiz','regenerate','content','lesson_assistant','tutor','chatbot'));
alter table public.ai_generations drop constraint if exists ai_generations_actor_type_check;
alter table public.ai_generations add constraint ai_generations_actor_type_check check (actor_type in ('admin','student','public'));
alter table public.ai_generations drop constraint if exists ai_generations_actor_key_check;
alter table public.ai_generations add constraint ai_generations_actor_key_check check (actor_key is null or actor_key ~ '^[a-f0-9]{64}$');

-- Lets the admin log show who made a request (every user has a profile since 0002).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'ai_generations_profile_fk') then
    alter table public.ai_generations add constraint ai_generations_profile_fk foreign key (created_by) references public.profiles(id) on delete set null;
  end if;
end $$;

create index if not exists ai_generations_kind_idx on public.ai_generations (kind, created_at desc);
create index if not exists ai_generations_actor_key_idx on public.ai_generations (actor_key, created_at desc) where actor_key is not null;
create index if not exists ai_generations_created_idx on public.ai_generations (created_at desc);

-- Students can see their own tutor usage (e.g. remaining daily requests). Admin read stays "ai" permission (0005).
-- Student and public rows are written only by trusted server code with the service role; nobody can insert them
-- from the browser (the existing insert policy requires the "ai" admin permission).
drop policy if exists ai_generations_own_read on public.ai_generations;
create policy ai_generations_own_read on public.ai_generations for select to authenticated
  using (created_by = auth.uid() and actor_type = 'student');

-- Questions: optional learning objective (filled by the AI quiz generator, editable by admins).
alter table public.questions add column if not exists learning_objective text;
