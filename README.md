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
- 🖼️ **Curated gallery** — public site only shows images **selected in admin**.
- 🛠️ **Admin dashboard** — OTP login, roles, artists, media, carousels (Phase 1).
- ♿ Respects `prefers-reduced-motion` (parallax and animations switch off).

## Stack

| Layer | Tech |
|-------|------|
| Public site | [Astro 5](https://astro.build) + [Tailwind CSS 4](https://tailwindcss.com) |
| Admin SPA | React (mounted from Astro) at `/catandcobra/admin/` |
| Runtime | **Cloudflare Workers** + Static Assets (**not** Pages) |
| API | Worker script + [Hono](https://hono.dev) under `/catandcobra/api/*` |
| Data | Cloudflare **D1** (`cat-and-cobra`) |
| Uploads | Cloudflare **R2** (`cat-and-cobra-media`) |
| OTP email | Cloudflare **Email Sending** (`EMAIL` binding) |
| Config | `wrangler.jsonc` |
| Deploy | Workers Builds (Git-connected) + optional GitHub Actions |

### Why Workers, not Pages?

This app needs a single process that:

1. Serves the static Astro build from `dist/`
2. Runs authenticated API routes with D1 + R2
3. Strips the `/catandcobra` path prefix on `terrerov.com`

That is **Workers + Static Assets** (`assets.directory` + `run_worker_first`).  
Cloudflare **Pages** is the wrong product here (no dual API Worker under the same
path without extra complexity). Do **not** create a Pages project for this repo.

## Quick start

```sh
npm install
npm run db:migrate:local          # D1 schema + seed users/artists
echo 'ENVIRONMENT=development' > .dev.vars
npm run dev:full                  # build + wrangler on :8787
```

| URL | Purpose |
|-----|---------|
| http://localhost:8787/catandcobra/ | Public site (with API) |
| http://localhost:8787/catandcobra/admin/ | Admin dashboard |
| http://localhost:4321/catandcobra/ | `npm run dev` — public only, **no** API/DB |

> **Base path:** production and local full stack use `/catandcobra`. Always open
> that prefix (not bare `/`).

### Useful scripts

```sh
npm run build              # prebuild indexes gallery + astro build → dist/
npm run gallery:index      # scan src/assets/gallery → public/gallery + worker index
npm run db:migrate:local   # apply migrations to local D1
npm run db:migrate:remote  # apply migrations to remote D1
npm run deploy             # wrangler deploy (build first)
```

## Admin dashboard (Phase 1)

**URL:** `/catandcobra/admin/`

### Auth

- Email + one-time code (OTP). No public registration.
- Only emails in `users` with `active = 1` can receive codes.
- Development: set `ENVIRONMENT=development` in `.dev.vars` — the OTP is
  returned as `devCode` in the API/UI when email cannot be sent.

### Roles

| Role | Capabilities |
|------|----------------|
| `system_admin` | Full control (users of all roles, content, future payments) |
| `owner` | Studio content + artists; invite `artist` users |
| `artist` | Own profile + own media / bookings (later) |

### Seed logins (change emails for production)

| Email | Role |
|-------|------|
| `admin@terrerov.com` | system_admin |
| `owner@catandcobra.com` | owner → doomkitten |
| `flyingsnail@catandcobra.com` | artist |
| `nolandvoid@catandcobra.com` | artist |
| `baphometaphysics@catandcobra.com` | artist |
| `deeziebeezie@catandcobra.com` | artist |

Edit seeds: `migrations/0002_seed.sql`, `migrations/0003_seed_artist_users.sql`,
or invite users from **Usuarios** in the admin UI.

### Modules (Phase 1)

- **Usuarios** — allowlist OTP, roles, activate/deactivate
- **Artistas** — roster, bios EN/ES, styles, accents
- **Galería** — full folder archive + R2 uploads, web publish flag, metadata, AI assist, carousels
- **Placeholders** — clients, bookings, promos, flash, guests, blog, aftercare, marketplace, payments, visits, social, campaigns

### Gallery selection (public website)

Images live in the admin archive; **they do not appear on the public site**
until published.

| Flag (D1 `media`) | Effect |
|-------------------|--------|
| `show_in_gallery` (**Mostrar en la web**) | Public `/gallery` + home featured teaser |
| `show_in_profile` | Samples on artist cards |

- Default for new/synced files: **both off**.
- Admin: toggle per image, or multi-select → **Publicar en la web** / **Quitar de la web**.
- Public pages load only published items via:
  - `GET /catandcobra/api/public/gallery`
  - `GET /catandcobra/api/public/profile-gallery/:artistId`
  - `GET /catandcobra/api/public/carousels/:idOrSlug`

### Admin gallery workflow

1. Drop files into `src/assets/gallery/` (see naming below).
2. `npm run gallery:index` (also runs on `prebuild`) → `public/gallery/` +
   `src/worker/data/gallery-index.json`.
3. Admin → **Sincronizar carpeta** (upserts into D1; does not auto-publish).
4. Select images → **Mostrar en la web** (and optionally profile).
5. Optional: multi-select → **Crear carrusel** for grouped carousels.

### First-time Cloudflare setup

Deploy fails with **D1 binding error 10181** if `database_id` in `wrangler.toml`
is still the local placeholder (`00000000-0000-0000-0000-000000000001`).

```sh
# Authenticate (or set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID)
npx wrangler login

# Create D1 + R2 (once per account)
npx wrangler d1 create cat-and-cobra
# → copy database_id into wrangler.toml [[d1_databases]]

npx wrangler r2 bucket create cat-and-cobra-media

# Enable transactional email from your zone
npx wrangler email sending enable terrerov.com

npm run db:migrate:local
npx wrangler d1 migrations apply cat-and-cobra --remote
```

Or run the GitHub Action **“Provision Cloudflare (D1 + R2)”** (`workflow_dispatch`)
if `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repo secrets are set; then
paste the printed `database_id` into `wrangler.toml` and push.

Worker name in config is **`catabdcobra`** (matches Cloudflare Workers Builds).

## Adding gallery photos (archive)

Drop photos into `src/assets/gallery/` named:

```
<artistId>__<styleId>__<designId>-<piece-slug>__<fresh|healed>.jpg
```

Example: `doomkitten__horror__occult-raven-skull__fresh.jpg`

Valid IDs: see `src/assets/gallery/README.md`, `src/data/styles.ts`,
`src/data/designs.ts`, `src/data/artists.ts`.

Then:

```sh
npm run gallery:index
# open admin → Sincronizar carpeta → publish selected images
```

### Download from Instagram (RapidAPI)

```sh
cp .env.example .env   # set INSTAGRAM_RAPIDAPI_KEY
npm run gallery:instagram
# or full website + Instagram:
npm run gallery:download
```

## Project layout (admin / API)

```
migrations/                 # D1 migrations (schema + seeds)
scripts/index-gallery-for-admin.mjs
src/admin/                  # React admin SPA
src/pages/admin/            # Astro shell for admin
src/worker/
  index.ts                  # route /catandcobra → API | assets
  api/                      # Hono routes (auth, users, artists, media, groups, public)
  data/gallery-index.json   # build-time index of folder images
  lib/                      # crypto, session, otp, email, mediaMap
src/components/GalleryGrid.astro   # public gallery (API-driven)
```

## Content (static copy)

- Artists (static fallbacks): `src/data/artists.ts`
- Styles / designs: `src/data/styles.ts`, `src/data/designs.ts`
- UI copy (EN/ES): `src/i18n/en.ts`, `src/i18n/es.ts`

## Cloudflare production map

| Resource | Name / value |
|----------|----------------|
| Worker | `catabdcobra` |
| Account | `1ddbfa86148b21137f5125cbdd637e8c` |
| Routes | `terrerov.com/catandcobra*`, `www.terrerov.com/catandcobra*` |
| D1 | `cat-and-cobra` → `35c2d2b0-4e08-4565-b4b2-7031b2901f70` |
| R2 | `cat-and-cobra-media` |
| Email binding | `EMAIL` (unrestricted send; onboard `terrerov.com` in Email Sending) |
| Observability | enabled in `wrangler.jsonc` |

### Email Sending (OTP)

1. Dashboard → **Email Service** → **Email Sending** → onboard **`terrerov.com`**
2. Confirm SPF/DKIM DNS records
3. From address: `noreply@terrerov.com` (or change `EMAIL_FROM` vars)

Until the domain is onboarded, OTP is written to **Workers logs**
(`[otp-fallback]`) so admins are not locked out.

## Deploying to Cloudflare Workers

Served at **`terrerov.com/catandcobra`** as Worker `catabdcobra` (coexists with
other zone routes via path patterns).

```sh
# Prefer OAuth with full scopes for local deploy:
# (avoid project .env CLOUDFLARE_API_TOKEN if it lacks D1 permissions)
npx wrangler login
npm run deploy                 # build + wrangler deploy
npm run db:migrate:remote      # after schema changes
npx wrangler types             # refresh worker-configuration.d.ts
```

- `base: '/catandcobra'` in `astro.config.mjs`
- Worker strips prefix, serves `/api/*` via Hono, assets from `dist/`
- **Primary CI:** Cloudflare Workers Builds (build: `npm run build`, deploy: `npx wrangler deploy`)
- **Optional CI:** `.github/workflows/deploy.yml` needs repo secrets
  `CLOUDFLARE_API_TOKEN` (Workers Scripts + D1 + R2 + Account Read) and
  `CLOUDFLARE_ACCOUNT_ID`

### Public API (no auth)

| Method | Path |
|--------|------|
| GET | `/catandcobra/api/health` |
| GET | `/catandcobra/api/public/artists` |
| GET | `/catandcobra/api/public/gallery` |
| GET | `/catandcobra/api/public/profile-gallery/:artistId` |
| GET | `/catandcobra/api/public/carousels/:idOrSlug` |

Authenticated admin API: `/catandcobra/api/auth/*`, `/users`, `/artists`,
`/media`, `/groups`, `/stats` (session cookie `cc_session`, path `/catandcobra`).

## Environment

| File | Purpose |
|------|---------|
| `.env` | Local tools (Instagram RapidAPI); never commit |
| `.dev.vars` | Wrangler local secrets/vars (`ENVIRONMENT=development`); never commit |
| `wrangler.toml` `[vars]` | Non-secret Worker config (`EMAIL_FROM`, TTL, etc.) |

See `.env.example` for documented keys.

## License

Private project — all rights reserved.
