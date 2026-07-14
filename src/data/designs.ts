import type { Locale } from '../i18n';

/**
 * Subject / composition category for a gallery piece.
 * Encoded in the filename slug as the first segment:
 *   artist__style__<designId>-<piece-slug>__fresh.jpg
 */
export interface Design {
  id: string;
  name: Record<Locale, string>;
}

export const designs: Design[] = [
  {
    id: 'character',
    name: { en: 'Characters', es: 'Personajes' },
  },
  {
    id: 'portrait',
    name: { en: 'Portraits', es: 'Retratos' },
  },
  {
    id: 'animal',
    name: { en: 'Animals', es: 'Animales' },
  },
  {
    id: 'occult',
    name: { en: 'Occult & dark', es: 'Oculto y dark' },
  },
  {
    id: 'flash',
    name: { en: 'Flash / walk-in', es: 'Flash / walk-in' },
  },
  {
    id: 'nature',
    name: { en: 'Nature & botanical', es: 'Naturaleza y botánico' },
  },
  {
    id: 'lettering',
    name: { en: 'Lettering', es: 'Lettering' },
  },
  {
    id: 'sleeve',
    name: { en: 'Sleeves', es: 'Mangas' },
  },
  {
    id: 'abstract',
    name: { en: 'Abstract', es: 'Abstracto' },
  },
  {
    id: 'other',
    name: { en: 'Other', es: 'Otros' },
  },
];

export function getDesign(id: string): Design | undefined {
  return designs.find((d) => d.id === id);
}

/** Pull design id off a gallery slug (`character-studio-abc` → `character`). */
export function designFromSlug(slug: string): string {
  const ids = designs.map((d) => d.id);
  for (const id of ids) {
    if (slug === id || slug.startsWith(`${id}-`)) return id;
  }
  return 'other';
}
