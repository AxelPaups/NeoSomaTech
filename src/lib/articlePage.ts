import { getArticle, listProducts } from './content';
import { extractFaqFromHtml } from './articleFaq';
import { loadLinkedQuestions, type LinkedQuestion } from './questionLinks';
import { path, type Locale } from '../i18n';

// Redirections 301 d'anciens slugs (majuscules/accents) vers leur version propre.
// Préserve le référencement des URLs déjà indexées après normalisation des slugs.
const SLUG_REDIRECTS: Record<string, string> = {
	'Exosquelette-de-Randonnée-Révolution-ou-Gadget-Sentiers': 'exosquelette-randonnee-revolution-ou-gadget-sentiers',
	// Consolidation du pilier ski (suppression du doublon) vers le slug propre
	'articles-exosquelette-ski-genou': 'exosquelette-ski-genou-guide-complet',
	'exosquelette-ski-guide-complet': 'exosquelette-ski-genou-guide-complet',
};

const ARTICLE_FIELDS =
	'id,titre,slug,description_seo,meta_description,contenu,date_publication,date_updated,auteur,image_principale';

export async function loadArticlePage(locale: Locale, slug: string | undefined) {
	const decoded = slug ? decodeURIComponent(slug) : '';
	const target = locale === 'fr' ? (slug && SLUG_REDIRECTS[slug]) || (decoded && SLUG_REDIRECTS[decoded]) : null;
	if (target) return { redirect: path(locale, 'articles', target), status: 301 as const };

	let article: any = null;
	let errorMessage: string | null = null;
	let productsForLinking: { name: string; slug: string }[] = [];
	let faqs: { question: string; reponse: string }[] = [];
	let linkedQuestions: LinkedQuestion[] = [];

	try {
		article = await getArticle(locale, slug ?? '', ARTICLE_FIELDS);
		if (article) faqs = extractFaqFromHtml(article.contenu);
		if (article) linkedQuestions = await loadLinkedQuestions(locale, 'article_lie', article.id);

		// Tous les produits de la langue, pour les liens automatiques dans le texte
		if (article) {
			const products = await listProducts(locale, 'Nom_du_produit,nom_court,slug', { limit: 100 });
			const has = (name: string) => productsForLinking.some((x) => x.name === name);
			for (const p of products) {
				if (!p.slug) continue;
				if (p.Nom_du_produit) productsForLinking.push({ name: p.Nom_du_produit, slug: p.slug });
				if (p.nom_court && p.nom_court !== p.Nom_du_produit) productsForLinking.push({ name: p.nom_court, slug: p.slug });

				// Mots-clés fréquents : facilite la détection des marques dans le texte
				const lower = String(p.Nom_du_produit ?? '').toLowerCase();
				if (lower.includes('ski-mojo')) {
					if (!has('Ski-Mojo')) productsForLinking.push({ name: 'Ski-Mojo', slug: p.slug });
					if (!has('Ski Mojo')) productsForLinking.push({ name: 'Ski Mojo', slug: p.slug });
				}
				if (lower.includes('hypershell') && !has('Hypershell')) productsForLinking.push({ name: 'Hypershell', slug: p.slug });
				if (lower.includes('stoko') && !has('Stoko')) productsForLinking.push({ name: 'Stoko', slug: p.slug });
			}
		}
	} catch (error: any) {
		console.error(`Erreur article ${slug}:`, error);
		errorMessage = error.message;
	}

	const alternates: Partial<Record<Locale, string>> = {};
	if (article?.slugs) {
		for (const [l, s] of Object.entries(article.slugs)) alternates[l as Locale] = path(l as Locale, 'articles', s as string);
	}

	return { article, productsForLinking, faqs, linkedQuestions, errorMessage, alternates, notFound: !article && !errorMessage };
}
