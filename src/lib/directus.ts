import { createDirectus, rest, staticToken } from '@directus/sdk';

// L'URL et le token viennent du fichier .env
const directusUrl = import.meta.env.PUBLIC_URL_DIRECT;
const directusToken = import.meta.env.PUBLIC_JETON_STATIQUE_DIRECT;

if (!directusUrl) {
    throw new Error('La variable PUBLIC_URL_DIRECT est manquante dans .env');
}

// Client Directus avec token statique si présent
export const directus = createDirectus(directusUrl)
    .with(directusToken ? staticToken(directusToken) : rest())
    .with(rest());
