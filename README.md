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

## Deploying to Cloudflare Pages

The site builds to static files in `dist/`, ready for Cloudflare Pages.

1. In the Cloudflare dashboard, go to **Workers & Pages → Create → Pages →
   Connect to Git** and pick this repo.
2. Build settings: framework preset **Astro**, build command `npm run
   build`, build output directory `dist`.
3. After the first deploy, go to the project's **Custom domains** tab and
   add `catandcobra.terrerov.com` (requires `terrerov.com` to be an active
   zone on the same Cloudflare account).

Alternatively, `.github/workflows/deploy.yml` deploys automatically on
push to `main` via `wrangler pages deploy` — add the
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repo secrets (Pages
Edit permission) for it to run.
