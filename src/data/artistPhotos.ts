/**
 * Local Instagram profile photos for each artist.
 * Drop files at `src/assets/artists/<artistId>.{jpg,jpeg,png,webp}`
 * (see scripts/download-artist-portraits.py).
 */
import type { ImageMetadata } from 'astro';

const files = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/artists/*.{jpg,jpeg,png,webp}',
  { eager: true },
);

const byId = new Map<string, ImageMetadata>();

for (const [path, mod] of Object.entries(files)) {
  const name = path.split('/').pop()!.replace(/\.[^.]+$/, '');
  // skip studio-only assets
  if (name.startsWith('catandcobra')) continue;
  byId.set(name, mod.default);
}

export function getArtistPhoto(artistId: string): ImageMetadata | undefined {
  return byId.get(artistId);
}

export const artistPhotoIds = [...byId.keys()];
