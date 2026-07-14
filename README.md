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
| API | Cloudflare Worker + [Hono](https://hono.dev) |
| Data | Cloudflare **D1** (SQLite) |
| Uploads | Cloudflare **R2** |
| OTP email | Cloudflare **Email Sending** (`send_email` binding) |
| Deploy | `wrangler` → `terrerov.com/catandcobra*` |

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

```sh
# Create D1 + R2 (once per account)
npx wrangler d1 create cat-and-cobra
# paste database_id into wrangler.toml → d1_databases.database_id
npx wrangler r2 bucket create cat-and-cobra-media

# Enable transactional email from your zone
npx wrangler email sending enable terrerov.com

npm run db:migrate:local   # or --remote for production DB
```

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

## Deploying to Cloudflare Workers

Served at **`terrerov.com/catandcobra`** as its own Worker (coexists with the
rest of the zone via specific routes).

```sh
npm run build
npm run db:migrate:remote    # after schema changes
npx wrangler deploy
```

- `base: '/catandcobra'` in `astro.config.mjs`
- Worker strips prefix, serves `/api/*` via Hono, assets from `dist/`
- Bindings: `DB` (D1), `MEDIA` (R2), `EMAIL`, `ASSETS`
- CI: `.github/workflows/deploy.yml` on `main` needs
  `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`

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
