import { createDirectus, rest, staticToken } from '@directus/sdk';

// Nous transformons l'export statique en une fonction qui prend l'environnement de Cloudflare.
// En local, env sera vide et il retombera sur import.meta.env
export const getDirectusClient = (platformEnv: any) => {
    // Fallback sécurisé en dur pour éviter tout crash lié à l'environnement Cloudflare Worker
    const directusUrl = platformEnv?.PUBLIC_URL_DIRECT ?? "https://spirited-squid.pikapod.net";
    const directusToken = platformEnv?.PUBLIC_JETON_STATIQUE_DIRECT ?? "0rDg_xkE3nqWlRECA3q3O2vxbh-RwytQ";

    if (!directusUrl) {
        throw new Error('La variable PUBLIC_URL_DIRECT est manquante.');
    }

    if (directusToken) {
        return createDirectus(directusUrl).with(staticToken(directusToken)).with(rest());
    } else {
        return createDirectus(directusUrl).with(rest());
    }
};
