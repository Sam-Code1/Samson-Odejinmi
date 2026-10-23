-- 0015: Profile photos. Idempotent, non-destructive.
--
-- Students upload a photo in Settings. Files live in a PUBLIC "avatars" bucket (profile photos are shown in the student
-- portal and next to reviews) under a folder named after the user's id; storage policies let a signed-in user write,
-- replace and delete ONLY inside their own folder. The profile stores the storage PATH (not a free URL), constrained to
-- that shape, so nobody can point their avatar at an arbitrary external address.

alter table public.profiles add column if not exists avatar_path text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_avatar_path_check') then
    alter table public.profiles add constraint profiles_avatar_path_check
      check (avatar_path is null or avatar_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/avatar-[0-9a-z]{6,40}\.(jpg|png|webp)$');
  end if;
end $$;

insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do update set public = true;
-- 2 MB, images only (enforced by Supabase Storage itself when these columns exist).
do $$
begin
  update storage.buckets set file_size_limit = 2097152, allowed_mime_types = array['image/jpeg','image/png','image/webp'] where id = 'avatars';
exception when undefined_column then null;
end $$;

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects for select to anon, authenticated using (bucket_id = 'avatars');
drop policy if exists "avatars own insert" on storage.objects;
create policy "avatars own insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars own update" on storage.objects;
create policy "avatars own update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatars own delete" on storage.objects;
create policy "avatars own delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Set or clear the caller's own photo. The path must be inside the caller's own folder.
create or replace function public.set_my_avatar(p_path text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if p_path is not null and split_part(p_path, '/', 1) <> auth.uid()::text then return false; end if;
  update public.profiles set avatar_path = p_path where id = auth.uid();
  return found;
end; $$;
revoke all on function public.set_my_avatar(text) from public, anon;
grant execute on function public.set_my_avatar(text) to authenticated;
