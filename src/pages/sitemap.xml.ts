import { fetchDirectus } from '../lib/directus';

export async function GET() {
  const baseUrl = 'https://neosomatech.com';

  // 1. Pages statiques
  const staticPages = [
    '',
    '/boutique',
    '/articles',
    '/a-propos',
    '/contact',
  ];

  try {
    // 2. Récupération des données dynamiques depuis Directus
    const [articles, produits] = await Promise.all([
      fetchDirectus('/items/Articles?fields=slug,date_publication'),
      fetchDirectus('/items/Produits?fields=slug'),
    ]);

    // Fonction pour tenter de parser la date (ou retourner la date du jour en repli)
    const formatDate = (dateStr: string) => {
      try {
        if (!dateStr) return new Date().toISOString();
        // Les dates dans Directus semblent être en format texte type "22 Mars 2026"
        // On essaie de parser, sinon on renvoie la date du jour pour que le sitemap soit valide
        const d = new Date(dateStr);
        return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
      } catch {
        return new Date().toISOString();
      }
    };

    // 3. Construction du XML
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${staticPages
    .map(
      (page) => `
  <url>
    <loc>${baseUrl}${page}</loc>
    <changefreq>daily</changefreq>
    <priority>${page === '' ? '1.0' : '0.8'}</priority>
  </url>`
    )
    .join('')}
  ${articles
    .map(
      (article: any) => `
  <url>
    <loc>${baseUrl}/articles/${article.slug}</loc>
    <lastmod>${formatDate(article.date_publication)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
    )
    .join('')}
  ${produits
    .map(
      (produit: any) => `
  <url>
    <loc>${baseUrl}/produits/${produit.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`
    )
    .join('')}
</urlset>`.trim();

    return new Response(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Erreur génération sitemap:', error);
    // En cas d'erreur Directus, on renvoie au moins les pages statiques pour ne pas casser le sitemap
    const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${staticPages
    .map(
      (page) => `
  <url>
    <loc>${baseUrl}${page}</loc>
    <changefreq>daily</changefreq>
    <priority>${page === '' ? '1.0' : '0.8'}</priority>
  </url>`
    )
    .join('')}
</urlset>`.trim();

    return new Response(fallbackSitemap, {
      headers: {
        'Content-Type': 'application/xml',
      },
    });
  }
}
