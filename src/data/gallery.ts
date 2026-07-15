import type { ImageMetadata } from 'astro';
import { designFromSlug } from './designs';

/**
 * Drop-in gallery: put photos in `src/assets/gallery/` named
 *
 *   <artistId>__<styleId>__<designId>-<piece-slug>__<fresh|healed>.<jpg|jpeg|png|webp>
 *
 * e.g.  doomkitten__horror__occult-raven-skull__fresh.jpg
 *       flyingsnail__anime__character-gohan-flatrate__fresh.jpg
 *
 * Both variants of the same piece share the slug and are merged into one
 * card with a fresh/healed toggle. No code changes needed — files appear
 * on the gallery page at next build.
 *
 * Design ids: character | portrait | animal | occult | flash | nature |
 * lettering | sleeve | abstract | other
 */

export interface GalleryPiece {
  key: string;
  artist: string;
  style: string;
  /** Subject / composition category (from slug prefix). */
  design: string;
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
  // skip helper / excluded folders
  if (path.includes('/_') || path.includes('\\_')) continue;

  const name = path.split('/').pop()!.replace(/\.[^.]+$/, '');
  const parts = name.split('__');
  if (parts.length !== 4) continue;
  const [artist, style, slug, variant] = parts as [string, string, string, string];
  if (variant !== 'fresh' && variant !== 'healed') continue;

  const design = designFromSlug(slug);
  const key = `${artist}__${style}__${slug}`;
  const piece = pieces.get(key) ?? { key, artist, style, design, slug };
  piece[variant] = mod.default;
  pieces.set(key, piece);
}

export const gallery: GalleryPiece[] = [...pieces.values()].sort((a, b) =>
  a.key.localeCompare(b.key),
);

export function galleryByArtist(artistId: string): GalleryPiece[] {
  return gallery.filter((p) => p.artist === artistId);
}

export function galleryByStyle(styleId: string): GalleryPiece[] {
  return gallery.filter((p) => p.style === styleId);
}

export function galleryByDesign(designId: string): GalleryPiece[] {
  return gallery.filter((p) => p.design === designId);
}
