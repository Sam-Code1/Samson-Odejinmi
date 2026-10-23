-- 0016: Portfolio gallery (the magazine of work on the main site). Idempotent, non-destructive.
--
-- One row per piece of work: an image or a video, in one category. Managed in Admin → Website → Gallery (upload,
-- category, featured, order, publish/hide, delete). Files are either part of the site (site-relative "/work/..." paths,
-- the work seeded below) or uploaded to the public academy-media bucket (full https URL).
-- Public visitors read published rows only; editing needs the "website" admin permission.

create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title text not null check (char_length(title) between 1 and 160),
  description text check (description is null or char_length(description) <= 600),
  category text not null check (category in ('environment-design','product-animation','3d-animation','graphic-design','video-editing','ai-automation','software-engineering')),
  series text check (series is null or char_length(series) <= 80),
  kind text not null default 'image' check (kind in ('image','video')),
  src text not null check (src ~ '^(/work/[A-Za-z0-9/_.-]+|https://[A-Za-z0-9.-]+/storage/v1/object/public/[A-Za-z0-9/_.%-]+)$'),
  poster text check (poster is null or poster ~ '^(/work/[A-Za-z0-9/_.-]+|https://[A-Za-z0-9.-]+/storage/v1/object/public/[A-Za-z0-9/_.%-]+)$'),
  link_url text check (link_url is null or link_url ~ '^https://'),
  width integer check (width is null or width >= 0),
  height integer check (height is null or height >= 0),
  tone text check (tone is null or tone ~ '^#[0-9a-fA-F]{6}$'),
  featured boolean not null default false,
  status text not null default 'published' check (status in ('published','draft','hidden')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gallery_items_public_idx on public.gallery_items (status, category, position);
drop trigger if exists trg_gallery_items_updated on public.gallery_items;
create trigger trg_gallery_items_updated before update on public.gallery_items for each row execute function public.set_updated_at();

alter table public.gallery_items enable row level security;
drop policy if exists gallery_items_public_read on public.gallery_items;
create policy gallery_items_public_read on public.gallery_items for select to anon, authenticated using (status = 'published' or public.has_admin_permission('website'));
drop policy if exists gallery_items_admin on public.gallery_items;
create policy gallery_items_admin on public.gallery_items for all to authenticated using (public.has_admin_permission('website')) with check (public.has_admin_permission('website'));
revoke all on public.gallery_items from anon, authenticated;
grant select on public.gallery_items to anon, authenticated;
grant insert, update, delete on public.gallery_items to authenticated;

-- The first collection (files shipped in public/work). Existing rows are never overwritten.
insert into public.gallery_items (slug, title, category, series, kind, src, poster, width, height, tone, featured, position) values
  ('rustic-bedroom-morning', 'Rustic bedroom, morning light', 'environment-design', 'Rustic room', 'image', '/work/environment-design/rustic-bedroom-morning.webp', null, 1536, 1024, '#281808', true, 10),
  ('rustic-bedroom-wide', 'Rustic bedroom, wide view', 'environment-design', 'Rustic room', 'image', '/work/environment-design/rustic-bedroom-wide.webp', null, 1536, 1024, '#281808', false, 20),
  ('rustic-bedroom-still-life', 'Woven basket and pails, still life', 'environment-design', 'Rustic room', 'image', '/work/environment-design/rustic-bedroom-still-life.webp', null, 1536, 1024, '#281808', false, 30),
  ('rustic-bedroom-window', 'Rustic bedroom, by the window', 'environment-design', 'Rustic room', 'image', '/work/environment-design/rustic-bedroom-window.webp', null, 1920, 1080, '#080808', false, 40),
  ('dining-interior-mural', 'Dining interior with graffiti mural', 'environment-design', null, 'image', '/work/environment-design/dining-interior-mural.webp', null, 1747, 1057, '#c8c8c8', false, 50),
  ('wireless-mouse-studio', 'Wireless mouse, studio render', 'product-animation', 'Wireless mouse', 'image', '/work/product-animation/wireless-mouse-studio.webp', null, 1920, 1080, '#a8a888', true, 60),
  ('wireless-mouse-neon', 'Wireless mouse, neon edge light', 'product-animation', 'Wireless mouse', 'image', '/work/product-animation/wireless-mouse-neon.webp', null, 736, 414, '#083818', false, 70),
  ('airpods-case-model', 'AirPods case, product model', 'product-animation', 'AirPods', 'image', '/work/product-animation/airpods-case-model.webp', null, 736, 414, '#98c8d8', false, 80),
  ('fox-character', 'Fox character model', '3d-animation', null, 'image', '/work/3d-animation/fox-character.webp', null, 736, 414, '#583818', true, 90),
  ('cheetah-bright-new-week', 'Cheetah: A bright new week of innovation', 'graphic-design', 'Cheetah campaign', 'image', '/work/graphic-design/cheetah-bright-new-week.webp', null, 1080, 1080, '#f8f8f8', false, 100),
  ('cheetah-digital-empire', 'Cheetah: Turn your hustle into a digital empire', 'graphic-design', 'Cheetah campaign', 'image', '/work/graphic-design/cheetah-digital-empire.webp', null, 1080, 1080, '#d8d8d8', true, 110),
  ('cheetah-no-stress', 'Cheetah: No stress, just sales', 'graphic-design', 'Cheetah campaign', 'image', '/work/graphic-design/cheetah-no-stress.webp', null, 1080, 1080, '#083818', false, 120),
  ('cheetah-sell-like-a-pro', 'Cheetah: Sell like a pro', 'graphic-design', 'Cheetah campaign', 'image', '/work/graphic-design/cheetah-sell-like-a-pro.webp', null, 1080, 1080, '#088848', false, 130),
  ('cheetah-every-sale-counts', 'Cheetah: Make every sale count', 'graphic-design', 'Cheetah campaign', 'image', '/work/graphic-design/cheetah-every-sale-counts.webp', null, 1080, 1080, '#e8e8d8', false, 140),
  ('cheetah-built-for-business', 'Cheetah: Built for your business', 'graphic-design', 'Cheetah campaign', 'image', '/work/graphic-design/cheetah-built-for-business.webp', null, 1080, 1080, '#c8d8c8', false, 150),
  ('marketgo-our-prices', 'MarketGo: Our prices', 'graphic-design', 'MarketGo', 'image', '/work/graphic-design/marketgo-our-prices.webp', null, 1024, 1536, '#f8f8f8', false, 160),
  ('marketgo-fresh-foodstuffs', 'MarketGo: Fresh foodstuffs and more', 'graphic-design', 'MarketGo', 'image', '/work/graphic-design/marketgo-fresh-foodstuffs.webp', null, 1080, 1350, '#f8f8f8', true, 170),
  ('marketgo-local-market', 'MarketGo: Your local market, closer than ever', 'graphic-design', 'MarketGo', 'image', '/work/graphic-design/marketgo-local-market.webp', null, 1024, 1536, '#f8f8f8', false, 180),
  ('marketgo-real-food', 'MarketGo: Real food, local markets', 'graphic-design', 'MarketGo', 'image', '/work/graphic-design/marketgo-real-food.webp', null, 1024, 1536, '#084818', false, 190),
  ('fola-visuals-creative-studio', 'Fola Visuals: Creative studio', 'graphic-design', 'Fola Visuals', 'image', '/work/graphic-design/fola-visuals-creative-studio.webp', null, 1122, 1402, '#080808', false, 200),
  ('fola-visuals-new-month', 'Fola Visuals: Happy new month', 'graphic-design', 'Fola Visuals', 'image', '/work/graphic-design/fola-visuals-new-month.webp', null, 1122, 1402, '#080808', false, 210),
  ('fola-visuals-graphic-design', 'Fola Visuals: Graphic design that defines your brand', 'graphic-design', 'Fola Visuals', 'image', '/work/graphic-design/fola-visuals-graphic-design.webp', null, 1254, 1254, '#080808', true, 220),
  ('fola-visuals-designer', 'Fola Visuals: Do you need a designer?', 'graphic-design', 'Fola Visuals', 'image', '/work/graphic-design/fola-visuals-designer.webp', null, 1254, 1254, '#f8e8e8', false, 230),
  ('fola-visuals-direction', 'Fola Visuals: Every direction for your brand', 'graphic-design', 'Fola Visuals', 'image', '/work/graphic-design/fola-visuals-direction.webp', null, 1122, 1402, '#080808', false, 240),
  ('fola-visuals-weekend', 'Fola Visuals: Just relax, it''s the weekend', 'graphic-design', 'Fola Visuals', 'image', '/work/graphic-design/fola-visuals-weekend.webp', null, 1149, 1369, '#080808', false, 250),
  ('cider-and-sisterhood-flyer', 'Cider & Sisterhood, women''s evening flyer', 'graphic-design', null, 'image', '/work/graphic-design/cider-and-sisterhood-flyer.webp', null, 1024, 1536, '#f8e8d8', false, 260),
  ('naming-ceremony-invitation', 'Naming ceremony invitation', 'graphic-design', null, 'image', '/work/graphic-design/naming-ceremony-invitation.webp', null, 1122, 1402, '#d86888', false, 270),
  ('todays-reflection', 'Today''s reflection: Be still', 'graphic-design', null, 'image', '/work/graphic-design/todays-reflection.webp', null, 1149, 1369, '#f8e8e8', false, 280),
  ('fola-academy-not-just-animation', 'Fola Academy: 3D isn''t just animation', 'graphic-design', 'Fola Academy', 'image', '/work/graphic-design/fola-academy-not-just-animation.webp', null, 1024, 1024, '#080818', false, 290),
  ('fola-academy-not-just-realism', 'Fola Academy: 3D isn''t just about realism', 'graphic-design', 'Fola Academy', 'image', '/work/graphic-design/fola-academy-not-just-realism.webp', null, 1024, 1024, '#080818', false, 300),
  ('fola-academy-beginners-struggle', 'Fola Academy: Why beginners struggle with Blender', 'graphic-design', 'Fola Academy', 'image', '/work/graphic-design/fola-academy-beginners-struggle.webp', null, 1024, 1024, '#080818', false, 310),
  ('fola-academy-more-than-a-model', 'Fola Academy: A 3D scene is more than a model', 'graphic-design', 'Fola Academy', 'image', '/work/graphic-design/fola-academy-more-than-a-model.webp', null, 1024, 1024, '#080808', false, 320),
  ('fola-academy-not-just-modelling', 'Fola Academy: 3D isn''t just modelling', 'graphic-design', 'Fola Academy', 'image', '/work/graphic-design/fola-academy-not-just-modelling.webp', null, 1024, 1024, '#080808', false, 330),
  ('fola-academy-understand-the-tool', 'Fola Academy: Don''t just learn the tool', 'graphic-design', 'Fola Academy', 'image', '/work/graphic-design/fola-academy-understand-the-tool.webp', null, 928, 1152, '#080818', false, 340),
  ('airpods-animation', 'AirPods, product animation', 'product-animation', 'AirPods', 'video', '/work/product-animation/airpods-animation.mp4', '/work/product-animation/airpods-animation-poster.webp', 736, 414, '#7fb1d8', true, 350)
on conflict (slug) do nothing;
