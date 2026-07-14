# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Mobile-first, app-like website for Cat and Cobra Tattoo Studio (Albuquerque, NM). Astro 5 + Tailwind CSS 4, **no client framework** — interactivity is small vanilla `<script>` blocks in the .astro components. Fully static build served by a Cloudflare Worker at `terrerov.com/catandcobra`.

## Commands

```sh
npm run dev        # local dev server
npm run build      # static build to dist/
npm run preview    # serve the build
npm run deploy     # wrangler deploy (build first; needs Cloudflare credentials)
```

There are no tests or linters. CI (`.github/workflows/deploy.yml`) builds and deploys on push to `main`.

## Architecture

### Base path — the most common footgun

The site deploys under `/catandcobra`, not at a domain root:

- `astro.config.mjs` sets `base: '/catandcobra'`, so every internal link and public-asset URL must be prefixed with `import.meta.env.BASE_URL` (usually via `localePath()` or the `base` variable pattern in `AppLayout.astro`). Never hardcode `/foo` paths.
- `src/worker/index.ts` strips the `/catandcobra` prefix before serving from the `dist/` assets binding (`wrangler.toml` routes `terrerov.com/catandcobra*`). The route intentionally coexists with whatever else serves `terrerov.com` — don't broaden it.

### i18n: thin pages, shared page components

Every route exists twice — English at `src/pages/*.astro`, Spanish at `src/pages/es/*.astro` — but both are 3-line shims that render the real page from `src/components/pages/*Page.astro` with a `locale` prop. Page content and logic live only in `components/pages/`; when adding a route, create the shared component plus both shims.

All UI copy lives in the dictionaries `src/i18n/en.ts` and `src/i18n/es.ts` (`es` must match the shape of `en` — `Dict = typeof en`). `src/i18n/index.ts` provides `useDict(locale)`, `localePath(locale, path)` (base + locale prefix; English has no prefix) and `altLocalePath()` for the language toggle.

### Theming: dual mood via CSS custom properties

Two themes — "cat" (light, cream/peach) and "cobra" (dark, charcoal/teal) — are driven by `data-theme` on `<html>` and the CSS variable palettes in `src/styles/global.css` (`--bg`, `--text`, `--accent`, `--duo`, …). Style with these variables, not literal colors. An inline script in `AppLayout.astro` applies the saved theme (`localStorage` key `cc-theme`, falling back to `prefers-color-scheme`) before paint and keeps `theme-color` in sync; `ThemeToggle.astro` flips it. Animations must respect `prefers-reduced-motion`.

### Layout and navigation

`src/layouts/AppLayout.astro` is the single layout: PWA meta, Astro `<ClientRouter />` view transitions, fixed bottom `TabBar`, header with theme/language toggles. The brand logo shares a `brand` view-transition name between the header and the home hero (`brandInHero` prop).

### Content and data

- Artists: `src/data/artists.ts`; styles: `src/data/styles.ts` (referenced by ID from gallery filenames).
- Gallery is convention-driven: `src/data/gallery.ts` globs `src/assets/gallery/**` and parses filenames `<artistId>__<styleId>__<piece-slug>__<fresh|healed>.<ext>`; fresh/healed variants sharing a slug merge into one card with a toggle. Adding photos requires no code changes.

### Logo assets

`public/logo/*.webp` (layered/animated logo, mascot cutouts) are **generated** by `scripts/build-logo-characters.py` and `scripts/build-logo-layers.py` (Pillow + NumPy + SciPy) from `src/assets/logo-original.png`. Don't hand-edit the webp outputs; rerun the scripts.
