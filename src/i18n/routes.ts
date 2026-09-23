import { defaultLocale, type Locale, locales } from './config';

// Segment d'URL de chaque section, par langue (les segments anglais sont de vrais mots anglais : meilleur pour le référencement).
const segments = {
	shop: { fr: 'boutique', en: 'shop' },
	product: { fr: 'produits', en: 'products' },
	articles: { fr: 'articles', en: 'articles' },
	compare: { fr: 'comparateur', en: 'compare' },
	advisor: { fr: 'conseiller', en: 'advisor' },
	about: { fr: 'a-propos', en: 'about' },
	contact: { fr: 'contact', en: 'contact' },
	author: { fr: 'auteur', en: 'author' },
} as const;

export type RouteName = 'home' | keyof typeof segments;

const prefix = (locale: Locale) => (locale === defaultLocale ? '' : `/${locale}`);

/** Chemin d'une page dans une langue : path('en', 'product', 'mon-slug') -> /en/products/mon-slug */
export function path(locale: Locale, route: RouteName, ...rest: (string | undefined)[]): string {
	const parts = [route === 'home' ? '' : segments[route][locale], ...rest].filter(Boolean) as string[];
	if (parts.length === 0) return locale === defaultLocale ? '/' : `/${locale}/`;
	return `${prefix(locale)}/${parts.join('/')}`;
}

/** Même page dans toutes les langues (utile quand la page existe partout, ex. boutique, comparateur). */
export function pathInAllLocales(route: RouteName, ...rest: (string | undefined)[]): Record<Locale, string> {
	return Object.fromEntries(locales.map((l) => [l, path(l, route, ...rest)])) as Record<Locale, string>;
}

// Pages légales : uniquement en français (droit français), on y renvoie depuis toutes les langues.
export const legalPaths = { notice: '/mentions-legales', cookies: '/politique-cookies' } as const;
