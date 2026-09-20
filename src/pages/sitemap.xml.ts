import { fetchDirectus, slugifyBrand } from '../lib/directus';

const baseUrl = 'https://neosomatech.com';

type StaticPage = { path: string; changefreq: string; priority: string };

// Pages fixes. Les pages légales sont volontairement absentes : sans intérêt pour le référencement.
const staticPages: StaticPage[] = [
  { path: '', changefreq: 'daily', priority: '1.0' },
  { path: '/boutique', changefreq: 'weekly', priority: '0.9' },
  { path: '/articles', changefreq: 'daily', priority: '0.8' },
  { path: '/comparateur', changefreq: 'weekly', priority: '0.8' },
  { path: '/a-propos', changefreq: 'monthly', priority: '0.5' },
  { path: '/auteur/axel-paupier', changefreq: 'monthly', priority: '0.5' },
  { path: '/contact', changefreq: 'yearly', priority: '0.3' },
];

// Renvoie une date ISO valide, ou null : mieux vaut pas de <lastmod> qu'une date fausse.
const toIso = (value: unknown): string | null => {
  if (!value) return null;
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d.toISOString();
};

const latest = (dates: (string | null)[]): string | null => {
  const valid = dates.filter((d): d is string => !!d).sort();
  return valid.length ? valid[valid.length - 1] : null;
};

const urlEntry = (loc: string, opts: { lastmod?: string | null; changefreq: string; priority: string }) => `
  <url>
    <loc>${loc}</loc>${opts.lastmod ? `\n    <lastmod>${opts.lastmod}</lastmod>` : ''}
    <changefreq>${opts.changefreq}</changefreq>
    <priority>${opts.priority}</priority>
  </url>`;

const wrap = (entries: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join('')}
</urlset>`;

export async function GET() {
  try {
    const [articles, produits] = await Promise.all([
      fetchDirectus('/items/Articles?limit=-1&fields=slug,date_publication'),
      fetchDirectus('/items/Produits?limit=-1&fields=slug,marque,date_analyse'),
    ]);

    const articleDates = (articles || []).map((a: any) => toIso(a.date_publication));
    const newestArticle = latest(articleDates);
    const newestProduct = latest((produits || []).map((p: any) => toIso(p.date_analyse)));

    // Dernière mise à jour connue par marque (à partir de date_analyse des produits)
    const brandLastmod = new Map<string, string | null>();
    for (const p of produits || []) {
      if (!p.marque) continue;
      const slug = slugifyBrand(p.marque);
      brandLastmod.set(slug, latest([brandLastmod.get(slug) ?? null, toIso(p.date_analyse)]));
    }

    const staticLastmod: Record<string, string | null> = {
      '': latest([newestArticle, newestProduct]),
      '/articles': newestArticle,
      '/boutique': newestProduct,
    };

    const entries = [
      ...staticPages.map((page) =>
        urlEntry(`${baseUrl}${page.path}`, { ...page, lastmod: staticLastmod[page.path] ?? null })
      ),
      ...(articles || []).map((article: any) =>
        urlEntry(`${baseUrl}/articles/${article.slug}`, {
          lastmod: toIso(article.date_publication),
          changefreq: 'monthly',
          priority: '0.7',
        })
      ),
      ...(produits || [])
        .filter((p: any) => p.slug)
        .map((produit: any) =>
          urlEntry(`${baseUrl}/produits/${produit.slug}`, {
            lastmod: toIso(produit.date_analyse),
            changefreq: 'weekly',
            priority: '0.9',
          })
        ),
      ...[...brandLastmod.entries()].map(([brandSlug, lastmod]) =>
        urlEntry(`${baseUrl}/boutique/${brandSlug}`, { lastmod, changefreq: 'weekly', priority: '0.8' })
      ),
    ];

    return new Response(wrap(entries).trim(), {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Erreur génération sitemap:', error);
    // Si Directus est indisponible, on sert au moins les pages fixes pour ne pas casser le sitemap.
    const fallback = wrap(staticPages.map((page) => urlEntry(`${baseUrl}${page.path}`, { ...page })));
    return new Response(fallback.trim(), { headers: { 'Content-Type': 'application/xml' } });
  }
}
