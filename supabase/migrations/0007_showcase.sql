-- 0007: portfolio showcase features.
--   - WhatsApp contact (site_settings.whatsapp_number / whatsapp_message), shown only when a number is set.
--   - Homepage hero: intro reveal words + the giant word behind an optional cut-out portrait (hero settings).
--   - Homepage "playground" block (the mini game), editable and hideable like every other block.
-- Non-destructive and idempotent: only adds columns/keys/rows that don't exist yet. Existing content is never changed.

alter table public.site_settings add column if not exists whatsapp_number text;
alter table public.site_settings add column if not exists whatsapp_message text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'site_settings_whatsapp_number_check') then
    alter table public.site_settings add constraint site_settings_whatsapp_number_check
      check (whatsapp_number is null or whatsapp_number ~ '^[1-9][0-9]{7,14}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'site_settings_whatsapp_message_check') then
    alter table public.site_settings add constraint site_settings_whatsapp_message_check
      check (whatsapp_message is null or char_length(whatsapp_message) <= 300);
  end if;
end $$;

-- Hero: intro words (the name reveal) and the backdrop word. Only added when the key isn't there yet.
update public.page_sections
set settings = settings || jsonb_build_object('intro_words', E'Samson\nOdejinmi')
where page = 'home' and section_key = 'hero' and not (settings ? 'intro_words');

update public.page_sections
set settings = settings || jsonb_build_object('backdrop_word', 'Fola')
where page = 'home' and section_key = 'hero' and not (settings ? 'backdrop_word');

-- Playground block, just before the contact call to action.
insert into public.page_sections (page, section_key, label, display_order, eyebrow, title, body, items, settings, status)
values ('home', 'playground', 'Playground (mini game)', 85, 'Playground', 'Break it if you can.',
        'A small game for the curious. Move with your mouse, finger or the arrow keys.',
        '[]'::jsonb, jsonb_build_object('game_text', E'MAKE\nWORLDS'), 'published')
on conflict (page, section_key) do nothing;

-- Accent styling for the homepage "Selected work" heading ("Selected *work*" → italic serif "work").
-- Only when the heading is still the original text, so an edited heading is never touched.
update public.page_sections set title = 'Selected *work*'
where page = 'home' and section_key = 'selected_work' and title = 'Selected work';
