import { createDirectus, rest } from '@directus/sdk';

// Lecture des variables d'environnement :
// - en local : import.meta.env.DIRECTUS_URL / DIRECTUS_STATIC_TOKEN (Astro)
// - en prod (Cloudflare Pages) : process.env.DIRECTUS_URL / DIRECTUS_STATIC_TOKEN
const DIRECTUS_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DIRECTUS_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.DIRECTUS_URL);

const DIRECTUS_STATIC_TOKEN =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DIRECTUS_STATIC_TOKEN) ||
  (typeof process !== 'undefined' && process.env && process.env.DIRECTUS_STATIC_TOKEN);

if (!DIRECTUS_URL) {
  console.warn("⚠️ DIRECTUS_URL n'est pas définie. Directus utilisera une URL vide, les requêtes échoueront.");
}

export const directus = createDirectus(DIRECTUS_URL || '').with(
  rest({
    onRequest: (options) => {
      if (DIRECTUS_STATIC_TOKEN) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${DIRECTUS_STATIC_TOKEN}`,
        };
      }
      return options;
    },
  })
);

export default directus;
