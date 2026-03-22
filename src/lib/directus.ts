// URL et Jeton écrits en dur pour garantir le fonctionnement serveur Cloudflare
const directusUrl = "https://spirited-squid.pikapod.net";
const directusToken = "0rDg_xkE3nqWlRECA3q3O2vxbh-RwytQ";

/**
 * Requête Fetch basique et universelle pour Cloudflare Workers/Pages
 * (Remplace le SDK lourd de Directus qui faisait crasher l'environnement Node.js de Cloudflare)
 */
export async function fetchDirectus(path: string) {
    const url = `${directusUrl}${path}`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${directusToken}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`Directus renvoie Erreur ${response.status}: ${response.statusText} sur ${url}`);
    }

    const json = await response.json();
    return json.data;
}
