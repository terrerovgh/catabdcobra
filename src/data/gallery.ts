import type { ImageMetadata } from 'astro';

/**
 * Drop-in gallery: put photos in `src/assets/gallery/` named
 *
 *   <artistId>__<styleId>__<piece-slug>__<fresh|healed>.<jpg|jpeg|png|webp>
 *
 * e.g.  doomkitten__horror__raven-skull__fresh.jpg
 *       doomkitten__horror__raven-skull__healed.jpg
 *
 * Both variants of the same piece share the slug and are merged into one
 * card with a fresh/healed toggle. No code changes needed — files appear
 * on the gallery page at next build.
 */

export interface GalleryPiece {
  key: string;
  artist: string;
  style: string;
  slug: string;
  fresh?: ImageMetadata;
  healed?: ImageMetadata;
}

const files = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/gallery/**/*.{jpg,jpeg,png,webp}',
  { eager: true },
);

const pieces = new Map<string, GalleryPiece>();

for (const [path, mod] of Object.entries(files)) {
  const name = path.split('/').pop()!.replace(/\.[^.]+$/, '');
  const parts = name.split('__');
  if (parts.length !== 4) continue;
  const [artist, style, slug, variant] = parts as [string, string, string, string];
  if (variant !== 'fresh' && variant !== 'healed') continue;

  const key = `${artist}__${style}__${slug}`;
  const piece = pieces.get(key) ?? { key, artist, style, slug };
  piece[variant] = mod.default;
  pieces.set(key, piece);
}

export const gallery: GalleryPiece[] = [...pieces.values()].sort((a, b) =>
  a.key.localeCompare(b.key),
);
