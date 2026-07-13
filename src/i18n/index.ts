import { en } from './en';
import { es } from './es';

export type Locale = 'en' | 'es';
export type Dict = typeof en;

const dicts: Record<Locale, Dict> = { en, es };

export function useDict(locale: Locale): Dict {
  return dicts[locale];
}

/** Prefix a site-relative path with the locale segment (en = no prefix). */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return locale === 'en' ? clean : `/${locale}${clean === '/' ? '' : clean}`;
}

/** The same page in the other language, for the language toggle. */
export function altLocalePath(locale: Locale, pathname: string): string {
  const stripped = pathname.replace(/^\/es(?=\/|$)/, '') || '/';
  return locale === 'en' ? `/es${stripped === '/' ? '' : stripped}` : stripped;
}
