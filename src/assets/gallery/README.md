# Gallery photos

Drop tattoo photos in this folder and they appear on the Gallery page at the
next build — no code changes needed.

## Naming convention

```
<artistId>__<styleId>__<piece-slug>__<fresh|healed>.<jpg|jpeg|png|webp>
```

Examples:

```
doomkitten__horror__raven-skull__fresh.jpg
doomkitten__horror__raven-skull__healed.jpg
flyingsnail__anime__totoro-sleeve__fresh.webp
```

- `fresh` and `healed` files that share the same artist/style/slug are merged
  into a single card with a fresh ⇄ healed toggle.
- A piece can have only one variant; the toggle simply won't show.
- Subfolders are fine — only the file name matters.

## Valid IDs

**Artists** (`src/data/artists.ts`): `doomkitten`, `flyingsnail`, `nolandvoid`,
`baphometaphysics`, `deeziebeezie`

**Styles** (`src/data/styles.ts`): `anime`, `neo-traditional`, `pop-culture`,
`fantasy`, `black-gray`, `horror`, `realism`
