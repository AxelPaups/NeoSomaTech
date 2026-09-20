/**
 * Utility to automatically wrap product names in links within HTML content.
 *
 * Règles SEO :
 * - Un seul lien automatique par produit et par page (première occurrence).
 *   Google ne compte que le premier lien vers une URL ; les répétitions
 *   n'apportent rien et sont un signal de sur-optimisation.
 * - Les liens posés manuellement dans Directus ont priorité : si un produit
 *   est déjà lié à la main, l'auto-linker ne le re-lie pas.
 */

interface ProductLink {
    name: string;
    slug: string;
}

export interface LinkifyOptions {
    /** Début de l'adresse d'une fiche produit dans la langue de la page */
    productBase?: string;
    /** Début de l'attribut title des liens ("Voir le produit : ...") */
    titlePrefix?: string;
}

export function linkifyProducts(html: string, products: ProductLink[], options: LinkifyOptions = {}) {
    const productBase = options.productBase ?? '/produits';
    const titlePrefix = options.titlePrefix ?? 'Voir le produit : ';
    const escapedBase = productBase.replace(/[.*+?^${}()|[\]\\/]/g, (c) => `\\${c}`);
    if (!html || !products || products.length === 0) return html;

    // Filter out empty names and sort by length descending to match longest names first
    const sortedProducts = products
        .filter(p => p.name && p.name.trim().length > 0)
        .sort((a, b) => b.name.length - a.name.length);

    if (sortedProducts.length === 0) return html;

    // Produits déjà liés sur la page -> on ne les re-lie pas.
    const linkedSlugs = new Set<string>();

    // Pré-remplir avec les produits déjà liés MANUELLEMENT dans le contenu Directus,
    // pour que les liens manuels aient priorité et ne soient jamais doublés.
    const existingLinkRegex = new RegExp(`href=["']${escapedBase}/([^"'#?]+)["']`, 'gi');
    let existing: RegExpExecArray | null;
    while ((existing = existingLinkRegex.exec(html)) !== null) {
        linkedSlugs.add(existing[1]);
    }

    // Build a regex pattern for all product names
    const escapedNames = sortedProducts.map(p => escapeRegExp(p.name)).join('|');

    // Regex logic:
    // 1. Match existing <a> tags (to avoid nesting links)
    // 2. Match any other HTML tags (to avoid replacing attributes)
    // 3. Match product names
    // We use capturing groups to identify what was matched
    const regex = new RegExp(`(<a[^>]*>.*?</a>|<[^>]+>)|(${escapedNames})`, 'gi');

    return html.replace(regex, (match, tag, productName) => {
        // If it's a tag (group 1), return it as is
        if (tag) return tag;

        // If it's a product name (group 2), wrap it in a link — once per product.
        if (productName) {
            const product = sortedProducts.find(p => p.name.toLowerCase() === productName.toLowerCase());
            if (product) {
                // Déjà un lien vers ce produit sur la page -> on laisse le texte brut.
                if (linkedSlugs.has(product.slug)) return productName;
                linkedSlugs.add(product.slug);
                return `<a href="${productBase}/${product.slug}" class="product-inline-link" title="${titlePrefix}${product.name}">${productName}</a>`;
            }
        }

        return match;
    });
}

function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
