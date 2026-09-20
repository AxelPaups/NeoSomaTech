export const locales = ['fr', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'fr';

export const localeMeta = {
	fr: { hreflang: 'fr', ogLocale: 'fr_FR', intl: 'fr-FR', currency: 'EUR', name: 'Français', short: 'FR' },
	en: { hreflang: 'en', ogLocale: 'en_US', intl: 'en-US', currency: 'USD', name: 'English', short: 'EN' },
} as const;

export const isLocale = (v: unknown): v is Locale => (locales as readonly string[]).includes(String(v));

/** Langue d'une URL : le préfixe /en/ désigne l'anglais, tout le reste est le français. */
export function localeFromPath(pathname: string): Locale {
	return /^\/en(\/|$)/.test(pathname) ? 'en' : defaultLocale;
}
