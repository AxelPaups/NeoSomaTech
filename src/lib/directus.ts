// URL et Jeton écrits en dur pour garantir le fonctionnement serveur Cloudflare
// URL et Jeton écrits en dur pour garantir le fonctionnement serveur Cloudflare
export const directusUrl = "https://spirited-squid.pikapod.net";
export const directusToken = "0rDg_xkE3nqWlRECA3q3O2vxbh-RwytQ";

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

/**
 * Fonction utilitaire pour récupérer le SEO d'une page fixe depuis Directus.
 * @param pageSlug L'identifiant de la page (ex: 'accueil', 'contact')
 * @param defaultTitle Titre de secours si Directus échoue
 * @param defaultDescription Description de secours si Directus échoue
 */
export async function fetchPageSEO(pageSlug: string, defaultTitle: string, defaultDescription: string) {
    try {
        const data = await fetchDirectus(`/items/SEO_Pages?filter[slug][_eq]=${pageSlug}&limit=1`);
        if (data && data.length > 0) {
            const seo = data[0];
            return {
                title: seo.meta_title || defaultTitle,
                description: seo.meta_description || defaultDescription
            };
        }
    } catch (error) {
        console.warn(`Impossible de récupérer le SEO pour la page ${pageSlug} depuis Directus:`, error);
    }
    
    // Fallback si la collection n'existe pas ou s'il y a une erreur
    return {
        title: defaultTitle,
        description: defaultDescription
    };
}
