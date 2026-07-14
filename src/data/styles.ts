import type { Locale } from '../i18n';

export type Mood = 'cat' | 'cobra';

export interface Style {
  id: string;
  name: Record<Locale, string>;
  desc: Record<Locale, string>;
  /** Which mascot fronts this style card (fallback / accent palette). */
  mood: Mood;
  /**
   * Gallery piece key used as the tattoo example on home style cards.
   * Format: artistId__styleId__slug (matches gallery.ts keys).
   */
  exampleKey: string;
}

/**
 * Curated close-up tattoo examples for each style card.
 * Chosen for clear style representation (real ink on skin).
 */
export const styles: Style[] = [
  {
    id: 'anime',
    name: { en: 'Anime & Cartoons', es: 'Anime y caricaturas' },
    desc: {
      en: 'Your favorite characters, inked with the love they deserve.',
      es: 'Tus personajes favoritos, tatuados con el cariño que merecen.',
    },
    mood: 'cat',
    // Gengar bubble-tea cartoon piece
    exampleKey: 'doomkitten__anime__character-dycubitkezd',
  },
  {
    id: 'neo-traditional',
    name: { en: 'Neo-traditional', es: 'Neotradicional' },
    desc: {
      en: 'Bold lines, rich palettes, modern folklore.',
      es: 'Líneas audaces, paletas ricas, folclore moderno.',
    },
    mood: 'cat',
    // Portrait + birds — bold linework & rich color (classic neo-trad feel)
    exampleKey: 'doomkitten__fantasy__animal-dyif6ekamgc',
  },
  {
    id: 'pop-culture',
    name: { en: 'Pop culture & Nerdy', es: 'Cultura pop y nerd' },
    desc: {
      en: 'Games, movies, comics — wear the things you love.',
      es: 'Videojuegos, cine, cómics: lleva puesto lo que amas.',
    },
    mood: 'cat',
    // Gundam mecha helmet on hand
    exampleKey: 'deeziebeezie__neo-traditional__flash-dsmg5iwdwgn',
  },
  {
    id: 'fantasy',
    name: { en: 'Fantasy', es: 'Fantasía' },
    desc: {
      en: 'Dragons, fae and worlds that never were.',
      es: 'Dragones, hadas y mundos que nunca existieron.',
    },
    mood: 'cat',
    // Fantasy serpent / creature flash
    exampleKey: 'flyingsnail__fantasy__character-dixhnozvrhf',
  },
  {
    id: 'black-gray',
    name: { en: 'Black & Gray', es: 'Negro y gris' },
    desc: {
      en: 'Smoke, texture and contrast that stays readable for decades.',
      es: 'Humo, textura y contraste que se mantiene legible por décadas.',
    },
    mood: 'cobra',
    // Full-back winged black & gray piece
    exampleKey: 'doomkitten__horror__sleeve-drixghnejfi',
  },
  {
    id: 'horror',
    name: { en: 'Horror', es: 'Horror' },
    desc: {
      en: 'Beautiful nightmares in permanent ink.',
      es: 'Pesadillas hermosas en tinta permanente.',
    },
    mood: 'cobra',
    // Decaying unicorn skull — clear horror subject
    exampleKey: 'doomkitten__horror__occult-img-5281-e432bf1b',
  },
  {
    id: 'realism',
    name: { en: 'Realism', es: 'Realismo' },
    desc: {
      en: 'Portraits and detail work that feels alive.',
      es: 'Retratos y detalle que se sienten vivos.',
    },
    mood: 'cobra',
    // Large-scale back piece with realistic face rendering
    exampleKey: 'doomkitten__horror__occult-dzks-enhcmu-1',
  },
];

export function getStyle(id: string): Style | undefined {
  return styles.find((s) => s.id === id);
}
