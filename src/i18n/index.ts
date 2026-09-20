import { fr, type Dict } from './fr';
import { en } from './en';
import type { Locale } from './config';

const dictionaries: Record<Locale, Dict> = { fr, en };

/** Textes de l'interface dans la langue demandée. */
export const useTranslations = (locale: Locale): Dict => dictionaries[locale];

export { locales, defaultLocale, localeMeta, localeFromPath, isLocale, type Locale } from './config';
export { path, pathInAllLocales, legalPaths, type RouteName } from './routes';
export type { Dict };

/** Remplace les {marqueurs} d'un texte : fmt('{n} avis', { n: 3 }) */
export const fmt = (text: string, vars: Record<string, string | number>) =>
	text.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ''));
