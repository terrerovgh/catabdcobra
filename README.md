# Cat & Cobra Tattoo Studio

Mobile-first, app-like website for **Cat and Cobra Tattoo Studio**
(301 Washington St SE, Albuquerque, NM). *Passion. Art. Precision.*

The two logo mascots star in the experience: the **cat** fronts the light
theme and friendly styles, the **cobra** fronts the dark theme and the
horror/blackwork side. Both are hand-built layered SVGs animated with CSS.

## Highlights

- 📱 **App feel** — fixed bottom tab bar, view transitions between pages,
  safe-area/notch support, PWA manifest.
- 🃏 **Swipe decks** — snap-scrolling card carousels with page dots and
  scroll-driven depth (center card pops, edges recede).
- 🌗 **Dual mood** — "cat mode" (cream/peach) ⇄ "cobra mode" (charcoal/teal),
  toggled by tapping the mascot switch, persisted in `localStorage`.
- 🪂 **Depth** — hero scene rebuilt from the logo in parallax layers that
  react to pointer and device tilt.
- 🌐 **Bilingual** — English at `/`, Spanish at `/es/`, toggle in the header.
- 🩹 **Aftercare hub** — traditional vs dermal-wrap protocols as interactive
  timelines, warnings, and FAQ accordions.
- ♿ Respects `prefers-reduced-motion` (parallax and animations switch off).

## Stack

[Astro 5](https://astro.build) + [Tailwind CSS 4](https://tailwindcss.com),
no client framework — a few small vanilla scripts handle gestures and state.

```sh
npm install
npm run dev      # local dev server
npm run build    # static build to dist/
npm run preview  # serve the build
```

## Adding gallery photos

Drop photos into `src/assets/gallery/` named

```
<artistId>__<styleId>__<piece-slug>__<fresh|healed>.jpg
```

and they appear on the Gallery page at the next build, with an automatic
fresh ⇄ healed toggle when both variants exist. See
`src/assets/gallery/README.md` for valid IDs.

## Content

- Artists: `src/data/artists.ts`
- Styles: `src/data/styles.ts`
- UI copy (EN/ES): `src/i18n/en.ts`, `src/i18n/es.ts`

## Deploying to Cloudflare Workers

The site is served at `terrerov.com/catandcobra` (not its own subdomain),
alongside whatever else already runs on that zone. It's deployed as its
own Cloudflare Worker with static assets:

- `astro.config.mjs` sets `base: '/catandcobra'` so all generated links
  and asset URLs carry the prefix.
- `src/worker/index.ts` strips the `/catandcobra` prefix before serving
  from the `dist/` assets binding, since the build output itself isn't
  nested under that path.
- `wrangler.toml` declares the Worker (assets directory `dist`) and a
  route `terrerov.com/catandcobra*` on the `terrerov.com` zone. Cloudflare
  matches the most specific route on a zone, so this coexists with
  whatever Worker currently serves the rest of `terrerov.com` — no need
  to touch it.

To deploy:

```sh
npm run build
npx wrangler deploy   # requires a Cloudflare API token with Workers Scripts + Zone edit
```

`.github/workflows/deploy.yml` runs the same on every push to `main` —
add the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repo secrets
for it to run.
