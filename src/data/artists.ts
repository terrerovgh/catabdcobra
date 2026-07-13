import type { Locale } from '../i18n';
import type { Mood } from './styles';

export interface Artist {
  id: string;
  handle: string;
  role: 'owner' | 'resident';
  styles: string[];
  bio: Record<Locale, string>;
  instagram: string;
  /** Mascot that fronts this artist's card + accent used on it. */
  mood: Mood;
  accent: string;
}

export const artists: Artist[] = [
  {
    id: 'doomkitten',
    handle: '@doomkitten',
    role: 'owner',
    styles: ['horror', 'neo-traditional'],
    bio: {
      en: 'Studio owner. Horror and neo-traditional specialist with national TV credits and a soft spot for rescue cats — the mind behind the studio’s animal-adoption ink events.',
      es: 'Dueño del estudio. Especialista en horror y neotradicional con créditos en TV nacional y debilidad por los gatos rescatados: la mente detrás de los eventos de adopción y tinta del estudio.',
    },
    instagram: 'https://instagram.com/doomkitten',
    mood: 'cobra',
    accent: '#e08a6c',
  },
  {
    id: 'flyingsnail',
    handle: '@flyingsnail.ink',
    role: 'resident',
    styles: ['anime', 'fantasy', 'pop-culture'],
    bio: {
      en: 'Fantasy, anime and cartoon worlds rendered in saturated color. If it made your inner nerd happy, it belongs on skin.',
      es: 'Mundos de fantasía, anime y caricatura en color saturado. Si le dio alegría a tu lado nerd, merece estar en la piel.',
    },
    instagram: 'https://instagram.com/flyingsnail.ink',
    mood: 'cat',
    accent: '#f0a8a0',
  },
  {
    id: 'nolandvoid',
    handle: '@nolandvoid_art',
    role: 'resident',
    styles: ['black-gray', 'realism', 'pop-culture'],
    bio: {
      en: 'Intricate black & gray and realism, famous for translating video-game art to skin — ask about the Hollow Knight pieces.',
      es: 'Negro y gris intrincado y realismo, famoso por traducir el arte de videojuegos a la piel: pregunta por las piezas de Hollow Knight.',
    },
    instagram: 'https://instagram.com/nolandvoid_art',
    mood: 'cobra',
    accent: '#87a794',
  },
  {
    id: 'baphometaphysics',
    handle: '@baphometaphysics',
    role: 'resident',
    styles: ['horror', 'black-gray', 'fantasy'],
    bio: {
      en: 'Custom design and alternative concepts, heavy on symbolism and fine detail — bring the strange idea nobody else would get.',
      es: 'Diseño personalizado y conceptos alternativos, con mucho simbolismo y detalle fino: trae esa idea rara que nadie más entendería.',
    },
    instagram: 'https://instagram.com/baphometaphysics',
    mood: 'cobra',
    accent: '#5f8271',
  },
  {
    id: 'deeziebeezie',
    handle: '@deeziebeezie',
    role: 'resident',
    styles: ['neo-traditional', 'pop-culture', 'anime'],
    bio: {
      en: 'Consistent, versatile and endlessly friendly — the artist that makes first-timers feel at home.',
      es: 'Consistente, versátil e infinitamente amigable: el artista que hace sentir en casa a quienes se tatúan por primera vez.',
    },
    instagram: 'https://instagram.com/deeziebeezie',
    mood: 'cat',
    accent: '#cf7051',
  },
];

export function getArtist(id: string): Artist | undefined {
  return artists.find((a) => a.id === id);
}
