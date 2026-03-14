import { createDirectus, rest, authentication } from '@directus/sdk';

// URL de base de ton instance Directus (PikaPods)
// Priorité aux variables Astro côté serveur, puis fallback sur process.env
const DIRECTUS_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DIRECTUS_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.DIRECTUS_URL);

// Jeton statique (ou token de service) pour l'authentification
const DIRECTUS_STATIC_TOKEN =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DIRECTUS_STATIC_TOKEN) ||
  (typeof process !== 'undefined' && process.env && process.env.DIRECTUS_STATIC_TOKEN);

if (!DIRECTUS_URL) {
  throw new Error('DIRECTUS_URL n’est pas définie dans les variables d’environnement.');
}

// Client Directus configuré avec transport REST et auth statique
export const directus = createDirectus(DIRECTUS_URL)
  .with(rest())
  .with(authentication('static', DIRECTUS_STATIC_TOKEN ?? null));

export default directus;

