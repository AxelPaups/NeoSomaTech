import { createDirectus, rest } from '@directus/sdk';

// On utilise l'URL en dur si la variable Cloudflare fait défaut
const url = import.meta.env.PUBLIC_URL_DIRECT || "https://spirited-squid.pikapod.net";
// Le token reste dynamique pour la sécurité
const token = import.meta.env.PUBLIC_JETON_STATIQUE_DIRECT || process.env.PUBLIC_JETON_STATIQUE_DIRECT;

const directus = createDirectus(url).with(rest({
    onRequest: (options) => {
        if (token) {
            options.headers = {
                ...options.headers,
                Authorization: `Bearer ${token}`,
            };
        }
        return options;
    },
}));

export default directus;