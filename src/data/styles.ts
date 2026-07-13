import type { Locale } from '../i18n';

export type Mood = 'cat' | 'cobra';

export interface Style {
  id: string;
  name: Record<Locale, string>;
  desc: Record<Locale, string>;
  /** Which mascot fronts this style card. */
  mood: Mood;
}

export const styles: Style[] = [
  {
    id: 'anime',
    name: { en: 'Anime & Cartoons', es: 'Anime y caricaturas' },
    desc: {
      en: 'Your favorite characters, inked with the love they deserve.',
      es: 'Tus personajes favoritos, tatuados con el cariño que merecen.',
    },
    mood: 'cat',
  },
  {
    id: 'neo-traditional',
    name: { en: 'Neo-traditional', es: 'Neotradicional' },
    desc: {
      en: 'Bold lines, rich palettes, modern folklore.',
      es: 'Líneas audaces, paletas ricas, folclore moderno.',
    },
    mood: 'cat',
  },
  {
    id: 'pop-culture',
    name: { en: 'Pop culture & Nerdy', es: 'Cultura pop y nerd' },
    desc: {
      en: 'Games, movies, comics — wear the things you love.',
      es: 'Videojuegos, cine, cómics: lleva puesto lo que amas.',
    },
    mood: 'cat',
  },
  {
    id: 'fantasy',
    name: { en: 'Fantasy', es: 'Fantasía' },
    desc: {
      en: 'Dragons, fae and worlds that never were.',
      es: 'Dragones, hadas y mundos que nunca existieron.',
    },
    mood: 'cat',
  },
  {
    id: 'black-gray',
    name: { en: 'Black & Gray', es: 'Negro y gris' },
    desc: {
      en: 'Smoke, texture and contrast that stays readable for decades.',
      es: 'Humo, textura y contraste que se mantiene legible por décadas.',
    },
    mood: 'cobra',
  },
  {
    id: 'horror',
    name: { en: 'Horror', es: 'Horror' },
    desc: {
      en: 'Beautiful nightmares in permanent ink.',
      es: 'Pesadillas hermosas en tinta permanente.',
    },
    mood: 'cobra',
  },
  {
    id: 'realism',
    name: { en: 'Realism', es: 'Realismo' },
    desc: {
      en: 'Portraits and detail work that feels alive.',
      es: 'Retratos y detalle que se sienten vivos.',
    },
    mood: 'cobra',
  },
];

export function getStyle(id: string): Style | undefined {
  return styles.find((s) => s.id === id);
}
