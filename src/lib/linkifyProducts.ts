/**
 * Utility to automatically wrap product names in links within HTML content.
 */

interface ProductLink {
    name: string;
    slug: string;
}

export function linkifyProducts(html: string, products: ProductLink[]) {
    if (!html || !products || products.length === 0) return html;

    // Filter out empty names and sort by length descending to match longest names first
    const sortedProducts = products
        .filter(p => p.name && p.name.trim().length > 0)
        .sort((a, b) => b.name.length - a.name.length);

    if (sortedProducts.length === 0) return html;

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

        // If it's a product name (group 2), wrap it in a link
        if (productName) {
            const product = sortedProducts.find(p => p.name.toLowerCase() === productName.toLowerCase());
            if (product) {
                return `<a href="/produits/${product.slug}" class="product-inline-link" title="Voir le produit : ${product.name}">${productName}</a>`;
            }
        }

        return match;
    });
}

function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
