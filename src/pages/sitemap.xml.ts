import { slugifyBrand } from '../lib/directus';
import { listArticles, listProducts, listQuestions } from '../lib/content';
import { defaultLocale, locales, path, type Locale, type RouteName } from '../i18n';

const baseUrl = 'https://neosomatech.com';

type Freq = { changefreq: string; priority: string };

// Une page logique, avec son adresse dans chaque langue où elle existe (les langues absentes n'ont pas de page).
type Group = Freq & { lastmod?: string | null; urls: Partial<Record<Locale, string>> };

// Pages fixes. Les pages légales sont volontairement absentes : sans intérêt pour le référencement.
const staticPages: { route: RouteName; freq: Freq; rest?: string[] }[] = [
	{ route: 'home', freq: { changefreq: 'daily', priority: '1.0' } },
	{ route: 'shop', freq: { changefreq: 'weekly', priority: '0.9' } },
	{ route: 'articles', freq: { changefreq: 'daily', priority: '0.8' } },
	{ route: 'compare', freq: { changefreq: 'weekly', priority: '0.8' } },
	{ route: 'about', freq: { changefreq: 'monthly', priority: '0.5' } },
	{ route: 'methodology', freq: { changefreq: 'monthly', priority: '0.6' } },
	{ route: 'questions', freq: { changefreq: 'weekly', priority: '0.7' } },
	{ route: 'author', rest: ['axel-paupier'], freq: { changefreq: 'monthly', priority: '0.5' } },
	{ route: 'contact', freq: { changefreq: 'yearly', priority: '0.3' } },
];

// Renvoie une date ISO valide, ou null : mieux vaut pas de <lastmod> qu'une date fausse.
const toIso = (value: unknown): string | null => {
	if (!value) return null;
	const d = new Date(String(value));
	return isNaN(d.getTime()) ? null : d.toISOString();
};

const latest = (dates: (string | null | undefined)[]): string | null => {
	const valid = dates.filter((d): d is string => !!d).sort();
	return valid.length ? valid[valid.length - 1] : null;
};

// Chaque version linguistique liste toutes les versions (elle-même comprise) + x-default vers le français.
const groupEntries = (g: Group): string[] => {
	const present = locales.filter((l) => g.urls[l]);
	const alternates = [
		...present.map((l) => `\n    <xhtml:link rel="alternate" hreflang="${l}" href="${baseUrl}${g.urls[l]}"/>`),
		...(g.urls[defaultLocale] ? [`\n    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}${g.urls[defaultLocale]}"/>`] : []),
	].join('');
	return present.map(
		(l) => `
  <url>
    <loc>${baseUrl}${g.urls[l]}</loc>${g.lastmod ? `\n    <lastmod>${g.lastmod}</lastmod>` : ''}
    <changefreq>${g.changefreq}</changefreq>
    <priority>${g.priority}</priority>${present.length > 1 ? alternates : ''}
  </url>`,
	);
};

const wrap = (entries: string[]) =>
	`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${entries.join('')}
</urlset>`;

const staticGroup = (route: RouteName, freq: Freq, lastmod: string | null, present: Locale[], rest: string[] = []): Group => ({
	...freq,
	lastmod,
	urls: Object.fromEntries(present.map((l) => [l, path(l, route, ...rest)])) as Group['urls'],
});

export async function GET() {
	try {
		const [articles, produits, questions] = await Promise.all([
			listArticles('fr', 'slug,date_publication,date_updated'),
			listProducts('fr', 'slug,marque,date_analyse'),
			listQuestions('fr', 'slug,date_publication,date_updated').catch(() => []),
		]);

		const newestArticle = latest(articles.map((a: any) => toIso(a.date_updated || a.date_publication)));
		const newestProduct = latest(produits.map((p: any) => toIso(p.date_analyse)));
		const lastmodOf: Partial<Record<RouteName, string | null>> = {
			home: latest([newestArticle, newestProduct]),
			articles: newestArticle,
			shop: newestProduct,
			questions: latest(questions.map((q: any) => toIso(q.date_updated || q.date_publication))),
		};

		// Les listes (boutique, articles, comparateur) n'existent dans une langue que si elle a du contenu traduit.
		const has = (items: any[], l: Locale) => l === defaultLocale || items.some((i) => i.slugs?.[l]);
		const listPresence: Partial<Record<RouteName, Locale[]>> = {
			shop: locales.filter((l) => has(produits, l)),
			compare: locales.filter((l) => has(produits, l)),
			articles: locales.filter((l) => has(articles, l)),
			// Le hub n'existe dans une langue que si elle a au moins une question traduite (aucune, aucune entrée).
			questions: locales.filter((l) => questions.some((q: any) => q.slugs?.[l])),
		};

		const groups: Group[] = [];

		for (const { route, freq, rest } of staticPages) {
			groups.push(staticGroup(route, freq, lastmodOf[route] ?? null, listPresence[route] ?? [...locales], rest));
		}

		for (const article of articles) {
			groups.push({
				changefreq: 'monthly',
				priority: '0.7',
				lastmod: toIso(article.date_updated || article.date_publication),
				urls: Object.fromEntries(
					locales.filter((l) => article.slugs?.[l]).map((l) => [l, path(l, 'articles', article.slugs[l])]),
				),
			});
		}

		for (const question of questions) {
			groups.push({
				changefreq: 'monthly',
				priority: '0.6',
				lastmod: toIso(question.date_updated || question.date_publication),
				urls: Object.fromEntries(
					locales.filter((l) => question.slugs?.[l]).map((l) => [l, path(l, 'questions', question.slugs[l])]),
				),
			});
		}

		for (const produit of produits.filter((p: any) => p.slug)) {
			groups.push({
				changefreq: 'weekly',
				priority: '0.9',
				lastmod: toIso(produit.date_analyse),
				urls: Object.fromEntries(
					locales.filter((l) => produit.slugs?.[l]).map((l) => [l, path(l, 'product', produit.slugs[l])]),
				),
			});
		}

		// Pages marque : une par marque, dans chaque langue où au moins un produit de la marque est traduit.
		const brands = new Map<string, { lastmod: string | null; locales: Set<Locale> }>();
		for (const p of produits) {
			if (!p.marque) continue;
			const slug = slugifyBrand(p.marque);
			const b = brands.get(slug) ?? { lastmod: null, locales: new Set<Locale>() };
			b.lastmod = latest([b.lastmod, toIso(p.date_analyse)]);
			for (const l of locales) if (p.slugs?.[l]) b.locales.add(l);
			brands.set(slug, b);
		}
		for (const [brandSlug, b] of brands) {
			groups.push({
				changefreq: 'weekly',
				priority: '0.8',
				lastmod: b.lastmod,
				urls: Object.fromEntries(locales.filter((l) => b.locales.has(l)).map((l) => [l, path(l, 'shop', brandSlug)])),
			});
		}

		return new Response(wrap(groups.flatMap(groupEntries)).trim(), {
			headers: {
				'Content-Type': 'application/xml',
				'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
			},
		});
	} catch (error) {
		console.error('Erreur génération sitemap:', error);
		// Si Directus est indisponible, on sert au moins les pages fixes françaises pour ne pas casser le sitemap.
		const fallback = wrap(staticPages.flatMap(({ route, freq, rest }) => groupEntries(staticGroup(route, freq, null, [defaultLocale], rest))));
		return new Response(fallback.trim(), { headers: { 'Content-Type': 'application/xml' } });
	}
}
