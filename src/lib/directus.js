import { createDirectus, rest } from '@directus/sdk';

// On supporte deux jeux de variables d'environnement :
// - LOCAL / ancien : DIRECTUS_URL, DIRECTUS_STATIC_TOKEN
// - CLOUDLFare (ce que tu as mis) : PUBLIC_URL_DIRECT, PUBLIC_JETON_STATIQUE_DIRECT

const DIRECTUS_URL =
  // Noms "PUBLIC_*" (Cloudflare, si tu les gardes comme ça)
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PUBLIC_URL_DIRECT) ||
  (typeof process !== 'undefined' && process.env && process.env.PUBLIC_URL_DIRECT) ||
  // Noms simples (local .env ou Cloudflare si tu changes les noms)
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DIRECTUS_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.DIRECTUS_URL);

const DIRECTUS_STATIC_TOKEN =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PUBLIC_JETON_STATIQUE_DIRECT) ||
  (typeof process !== 'undefined' && process.env && process.env.PUBLIC_JETON_STATIQUE_DIRECT) ||
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DIRECTUS_STATIC_TOKEN) ||
  (typeof process !== 'undefined' && process.env && process.env.DIRECTUS_STATIC_TOKEN);

if (!DIRECTUS_URL) {
  console.warn("⚠️ DIRECTUS_URL / PUBLIC_URL_DIRECT n'est pas définie. Les requêtes Directus échoueront.");
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