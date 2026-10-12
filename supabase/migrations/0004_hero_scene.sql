-- 0004: the homepage hero is now built on the interactive 3D (Spline) card.
-- Moves the Spline scene URL from the retired "interactive_3d" block into the hero's settings, then removes that block.
-- Safe to re-run. Keeps any scene URL you've already set on the hero.

update public.page_sections h
set settings = h.settings || jsonb_build_object('scene_url', i.settings->>'scene_url')
from public.page_sections i
where h.page = 'home' and h.section_key = 'hero'
  and i.page = 'home' and i.section_key = 'interactive_3d'
  and not (h.settings ? 'scene_url')
  and coalesce(i.settings->>'scene_url', '') <> '';

update public.page_sections
set settings = settings || '{"scene_url":"https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"}'::jsonb
where page = 'home' and section_key = 'hero' and not (settings ? 'scene_url');

delete from public.page_sections where page = 'home' and section_key = 'interactive_3d';
