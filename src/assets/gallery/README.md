# Gallery photos

Drop tattoo photos in this folder and they appear on the Gallery page at the
next build — no code changes needed.

## Naming convention

```
<artistId>__<styleId>__<designId>-<piece-slug>__<fresh|healed>.<jpg|jpeg|png|webp>
```

Examples:

```
doomkitten__horror__occult-raven-skull__fresh.jpg
doomkitten__horror__occult-raven-skull__healed.jpg
flyingsnail__anime__character-totoro-sleeve__fresh.webp
```

- `fresh` and `healed` files that share the same artist/style/slug are merged
  into a single card with a fresh ⇄ healed toggle.
- A piece can have only one variant; the toggle simply won't show.
- Subfolders are fine — only the file name matters.
- Files under `_excluded/` are ignored by the gallery.

## Valid IDs

**Artists** (`src/data/artists.ts`): `doomkitten`, `flyingsnail`, `nolandvoid`,
`baphometaphysics`, `deeziebeezie`

**Styles** (`src/data/styles.ts`): `anime`, `neo-traditional`, `pop-culture`,
`fantasy`, `black-gray`, `horror`, `realism`

**Designs** (`src/data/designs.ts`): `character`, `portrait`, `animal`,
`occult`, `flash`, `nature`, `lettering`, `sleeve`, `abstract`, `other`

## Re-categorize

```sh
# Uses captions (if RapidAPI quota allows) + local ImageMagick analysis
python3 scripts/categorize-gallery.py --skip-fetch   # captions cache only
python3 scripts/reclassify-gallery-local.py          # sat/style/design refine
```

Catalog output: `src/data/gallery-catalog.json`

## Auto-download from live sources

Images can be pulled from:

- Website: [catandcobra.com](https://www.catandcobra.com) (Squarespace sitemap + pages)
- Instagram via **RapidAPI** (preferred): studio + artist accounts

### Setup (`.env`)

```sh
cp .env.example .env
# paste your RapidAPI key into INSTAGRAM_RAPIDAPI_KEY
```

1. Get a key: [RapidAPI dashboard](https://rapidapi.com/developer/dashboard)
2. Subscribe to
   [Instagram Scraper Stable API](https://rapidapi.com/thetechguy32744/api/instagram-scraper-stable-api)
3. Keep these vars in `.env`:

```env
INSTAGRAM_RAPIDAPI_KEY=your_key_here
INSTAGRAM_RAPIDAPI_HOST=instagram-scraper-stable-api.p.rapidapi.com
INSTAGRAM_RAPIDAPI_POSTS_PATH=/get_ig_user_posts.php
INSTAGRAM_RAPIDAPI_METHOD=POST
INSTAGRAM_RAPIDAPI_AMOUNT=12
```

### Commands

```sh
# Instagram only (RapidAPI)
npm run gallery:instagram
# or
python3 scripts/download-instagram-rapidapi.py
python3 scripts/download-instagram-rapidapi.py --user doomkitten --max-pages 5
python3 scripts/download-instagram-rapidapi.py --user flyingsnail.ink --max-posts 20

# Website + Instagram
npm run gallery:download
python3 scripts/download-gallery-images.py --skip-instagram   # site only
python3 scripts/download-gallery-images.py --instagram-only
```

Already-present files are skipped. `DOWNLOAD_MANIFEST.json` records source URLs.

If RapidAPI returns `You are not subscribed to this API`, open the API page above,
click **Subscribe**, then re-run.

**Caveats of the auto-tagging:**

- Most website portfolio pages belong to **doomkitten**, so that is the default
  artist/style (`horror`). Re-name files if a piece belongs to another artist.
- Studio Instagram posts (`@catandcobra`) are filed under `doomkitten` (owner).
- Style is each artist's primary style, not per-image classification.
- Delete anything that is not a tattoo (stories, merch, logos).