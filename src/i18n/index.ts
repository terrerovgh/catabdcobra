import { en } from './en';
import { es } from './es';

export type Locale = 'en' | 'es';
export type Dict = typeof en;

const dicts: Record<Locale, Dict> = { en, es };

export function useDict(locale: Locale): Dict {
  return dicts[locale];
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Prefix a site-relative path with the deployment base and locale segment (en = no locale prefix). */
export function localePath(locale: Locale, path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`;
  const localized = locale === 'en' ? clean : `/${locale}${clean === '/' ? '' : clean}`;
  return `${BASE}${localized}`;
}

/** The same page in the other language, for the language toggle. */
export function altLocalePath(locale: Locale, pathname: string): string {
  const relative = BASE && pathname.startsWith(BASE) ? pathname.slice(BASE.length) || '/' : pathname;
  const stripped = relative.replace(/^\/es(?=\/|$)/, '') || '/';
  const localized = locale === 'en' ? `/es${stripped === '/' ? '' : stripped}` : stripped;
  return `${BASE}${localized}`;
}
