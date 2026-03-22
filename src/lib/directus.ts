import { createDirectus, rest, staticToken } from '@directus/sdk';

// Nous transformons l'export statique en une fonction qui prend l'environnement de Cloudflare.
// En local, env sera vide et il retombera sur import.meta.env
export const getDirectusClient = (platformEnv: any) => {
    const directusUrl = platformEnv?.PUBLIC_URL_DIRECT ?? import.meta.env.PUBLIC_URL_DIRECT;
    const directusToken = platformEnv?.PUBLIC_JETON_STATIQUE_DIRECT ?? import.meta.env.PUBLIC_JETON_STATIQUE_DIRECT;

    if (!directusUrl) {
        throw new Error('La variable PUBLIC_URL_DIRECT est manquante.');
    }

    return createDirectus(directusUrl)
        .with(directusToken ? staticToken(directusToken) : rest())
        .with(rest());
};
