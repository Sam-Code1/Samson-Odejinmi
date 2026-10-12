# Design language — Samson Odejinmi + Fola Academy

One ecosystem, two voices. The main site is a practitioner speaking in the first person. The Academy is a calmer teaching voice. They share tokens, type, navigation and the light thread.

## Brand principles
- Creative capability and technical curiosity, in equal measure. Not a generic developer, not only a 3D artist.
- Honest. Nothing is invented: no clients, awards, statistics, testimonials or experience claims. Work in progress is labelled "exploring" or "developing". Missing content becomes a placeholder or an empty state, never a lie.
- Calm, premium, personal. Minimal but not empty.
- Copy sounds like a person with a point of view: plain verbs, sentence case, no marketing clichés.

## Colour system
Colours are semantic CSS variables (RGB triplets) in `src/app/globals.css`, mapped in `tailwind.config.ts`. Components use names (`bg-canvas`, `text-ink-2`, `border-line`), never hex.

| Token | Dark | Light |
|---|---|---|
| canvas | `#070A12` | `#F5F5F2` |
| surface | `#0B1020` | `#ECEEF1` |
| elevated | `#11182A` | `#FCFCFA` |
| ink (primary text) | `#F5F7FF` | `#0D1226` |
| ink-2 (secondary) | `#A6AEC2` | `#424B68` |
| ink-3 (muted) | `#7A839C` | `#626A87` |
| blue / blue-soft | `#4D8DFF` / `#6AA8FF` | `#2662E0` / `#427DF0` |
| violet / violet-soft | `#8B5CF6` / `#A78BFA` | `#6D43D9` / `#8B69EB` |
| line | blue-grey @ 14% | navy @ 14% |

Notes: dark muted text is `#7A839C` rather than the brief's `#6F7890` so small text clears 4.5:1 on the canvas. Light is authored separately (warm off-white, cool-grey surfaces, navy text, deeper blue/violet for contrast), not inverted.

Blue and violet are accents: light, energy, focus, direction. Primary buttons are ink-on-canvas; accent appears in the thread, focus rings, selected states and artwork.

### The light thread
A blue→violet hairline (`.thread`, `.thread-solid`, `.thread-v`). Used in: section dividers, active nav underline, hover lines under links, step markers, selected lesson, card top edges, the image-frame edge. Not used as fills or large gradients.

## Colour mix (light mode)
Light mode is no longer a single flat off-white. It follows a 60 / 30 / 10 split: a soft lilac-white base (60), tinted section bands (30), and blue, violet and a touch of warm coral as accents (10).

| Token | Light | Dark |
|---|---|---|
| canvas | `#F9F8FD` | `#070A12` |
| tint-blue | `#DEE8FF` | `#0C1A3C` |
| tint-violet | `#EBE3FF` | `#1A123A` |
| tint-peach | `#FFEAE0` | `#2E1A20` |
| tint-mint | `#DAF4EC` | `#0A282A` |
| warm (accent only) | `#D66038` | `#FF8C64` |

- `Section tone="blue|violet|peach|mint|surface"` picks a band. Sections alternate tint so no two neighbours match.
- `Section tone="night"` (class `.theme-night`) is a dark band that stays dark in light mode. Alternating temperature with the same palette is what gives the page rhythm. Footers are night bands.
- `.mesh` is a soft blue/violet/warm wash for heroes; `.grain` adds fine texture so colour reads as light, not paint.
- Text colours were darkened slightly (ink-3 `#565E7D`) so they still clear 4.5:1 on every tint.

## Theme system
- Preference: `light | system | dark`, default `system`. Stored in `localStorage["theme"]`.
- No flash: a blocking inline script in `<head>` (`src/lib/theme-script.ts`) resolves the preference and sets `data-theme`, `data-theme-pref` and `color-scheme` on `<html>` before first paint. A CSS `prefers-color-scheme` fallback covers no-JS.
- System mode listens to `matchMedia` and updates live.
- Switch animation: `html.theme-switching` applies a 240 ms colour transition for ~320 ms only, and is disabled under `prefers-reduced-motion`.
- Artwork (hero, Academy visual, placeholders) is SVG driven by `--art-*` tokens, so it re-lights per theme.

## Typography
One family everywhere: **Manrope** (`next/font/google`, weights 400-800, exposed as `--font-manrope`). Hierarchy comes from scale, weight and spacing.

| Style | Mobile → desktop | Weight | Use |
|---|---|---|---|
| display | 40 → 64px | 700 | Hero only |
| h1 | 32 → 56px | 700 | Page titles |
| h2 | 26 → 42px | 600 | Sections |
| h3 | 22 → 32px | 600 | Sub-sections |
| h4 | 20px | 600 | Item titles |
| body-lg / body / body-sm | 18 / 16 / 14px | 400 | Copy, tables |
| caption / label / meta | 13 / 14 / 12px | 400-600 | Metadata, controls |
| admin-title | 32 → 44px | 700 | Admin page titles |
| admin-section | 18px | 600 | Admin panels |

Line length ≤ 62ch (`max-w-prose`). No all-caps eyebrows on the public site.

## Spacing, layout, radius
- Container: `max-w-page` 1320 px, gutters 20 / 32 / 48 px.
- Sections: `py-20 → 36` by breakpoint. 12-column editorial grid; asymmetric offsets for work and Academy; full-bleed media only where it earns it.
- Radius: 3–8 px. Cards are the exception, not the rule: structure comes from rules, numbering, whitespace and alignment.
- Borders: 14% line colour; used for separation, metadata and form controls, not to outline everything.
- Numbering appears only where the content is a sequence (projects, process, modules, learning stages).

## Components
Integrated from 21st.dev and adapted (see file headers): `src/components/ui/carousel-07.tsx` (stacked drag carousel, used for Work and Academy modules) and `src/components/ui/hero-preview-walls.tsx` (`HeroPreviewWalls` for the home hero, `CardSlide` for the project workflow and the Academy learning model via `StepStack`).
Also integrated: `src/components/ui/splite.tsx` (Spline scene, 21st.dev), `spotlight.tsx` (ibelick spotlight, recoloured with tokens) and `card.tsx` (shadcn Card mapped to project tokens). They use the lowercase shadcn file names in `components/ui` so future `npx shadcn add` components land next to them.
Reuse before creating: `Container/Section/SectionHeader/Thread`, `Button`, `Badge`, `Accordion`, `ProgressBar`, `StateMessage/EmptyState/ErrorState/LoadingBlock`, `MediaFrame`, `ProjectCard`, `ThemeSwitcher`, `Navbar` (main + academy), `Footer`/`AcademyFooter`, `VideoPlayer`, `CourseSidebar`/`LessonDrawer`, form fields.

## Motion
Quiet and purposeful, via `motion/react`:
- One orchestrated hero entrance (staggered rise) on Home and Academy.
- Image reveals on project frames; hover movement on links and list rows.
- A soft page fade (`template.tsx`).
- Everything respects `prefers-reduced-motion`. No parallax or decorative WebGL, with one deliberate exception: the homepage hero (`HeroPreviewWalls` in `src/components/ui/hero-preview-walls.tsx`) is a night card with the hero text on the left and a real-time Spline scene on the right (`src/components/sections/LazySpline.tsx`), plus a soft cursor spotlight. The spotlight is off under reduced motion; an empty scene URL falls back to the static HeroVisual art.

## Accessibility
Semantic landmarks and heading order, skip link, visible focus ring, 44 px touch targets, `aria-current`/`aria-expanded`/`radiogroup` semantics on nav, theme and currency controls, native `<details>` accordions, alt text on all meaningful images, form errors announced with `role="alert"`, drawer with Escape and focus return.

## Responsive rules
Designed at 320, 375, 390, 430, 768, 1024, 1280, 1440, 1920. Mobile gets its own composition: full-screen menu with inline theme control, hero visual below the headline, stacked and offset work layouts, lesson drawer instead of sidebar.

## Admin ("the control room")
Same tokens, same fonts, same theme system, only denser: 14px tables, 16px card titles, 13-14px supporting text, content up to 1400px, page padding 16 / 24 / 40px. Surfaces are `canvas` / `elevated` with 14% borders; blue and violet appear only as small active states and the thread. Tinted section colours and grain are public-site tools and are not used in Admin. Motion is limited to hover and focus transitions.

Building blocks live in `src/components/admin/`: `AdminShell` (sidebar + mobile drawer + toasts), `PageHeader`/`Panel`, `StatCard`, `DataTable` (table on desktop, cards on mobile), `Filters` (search + filter), `Pagination`, `StatusBadge`, `AdminForm` + `FormFields` (validation, unsaved-changes warning, toasts), `ActionButton` (one-click server actions with confirm dialogs), `TabNav`, empty/error/loading states.
