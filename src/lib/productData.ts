import { fetchDirectus } from './directus';
import { PRODUCT_FIELDS } from './productPage';
import { getProduct, listProducts } from './content';
import { path, type Locale } from '../i18n';

// Redirections 301 d'anciens slugs produits supprimés ou renommés, vers la page de marque
// correspondante (préserve le référencement des URLs indexées). Français uniquement.
const PRODUCT_REDIRECTS: Record<string, string> = {
	'dnsys-x1-exoskeleton': '/boutique/dnsys',
	'stoko-k1-supportive-tight-exosquelette-textile': '/boutique/stoko',
	'ecece': '/boutique',
};

const SIMILAR_FIELDS = 'id,Nom_du_produit,prix,devise,descripton_simple,slug,image,marque';

export async function loadProductPage(locale: Locale, slug: string | undefined) {
	if (locale === 'fr' && slug && PRODUCT_REDIRECTS[slug]) {
		return { redirect: PRODUCT_REDIRECTS[slug], status: 301 as const };
	}

	let produit: any = null;
	let produitsSimilaires: any[] = [];
	let avis: any[] = [];
	let articlesLies: any[] = [];
	let errorMessage: string | null = null;

	try {
		produit = await getProduct(locale, slug ?? '', PRODUCT_FIELDS);

		// Les variantes de taille contiennent des textes non traduits : réservées au français pour l'instant.
		if (produit && locale !== 'fr') produit.variantes = [];

		if (produit) {
			// Produits similaires : même marque d'abord, puis les autres, jusqu'à 4 (dans la langue de la page)
			const all = await listProducts(locale, SIMILAR_FIELDS, { limit: 100 });
			const others = all.filter((p: any) => p.id !== produit.id);
			const sameBrand = produit.marque ? others.filter((p: any) => p.marque === produit.marque) : [];
			const rest = others.filter((p: any) => !sameBrand.includes(p));
			produitsSimilaires = [...sameBrand.slice(0, 4), ...rest].slice(0, 4);

			// Avis : rattachés au slug français de la fiche, communs à toutes les langues
			try {
				const avisData = await fetchDirectus(
					`/items/Avis?filter[produit_slug][_eq]=${encodeURIComponent(produit.slugs.fr)}&fields=prenom,note,avis_texte,date_created&limit=50`,
				);
				avis = Array.isArray(avisData) ? avisData : [];
			} catch {
				avis = [];
			}

			// Articles liés : cherche la marque (sinon le nom du produit) dans le contenu, dans la langue de la page
			try {
				const term = encodeURIComponent(produit.marque || produit.Nom_du_produit || '');
				if (locale === 'fr') {
					const data = await fetchDirectus(
						`/items/Articles?filter[contenu][_contains]=${term}&fields=titre,slug,description_seo,image_principale,date_publication&limit=3`,
					);
					articlesLies = Array.isArray(data) ? data.filter((a: any) => a && a.slug) : [];
				} else {
					const data = await fetchDirectus(
						`/items/Articles_translations?filter[languages_code][_eq]=${locale}&filter[contenu][_contains]=${term}&fields=titre,slug,description_seo,Articles_id.image_principale,Articles_id.date_publication&limit=3`,
					);
					articlesLies = (Array.isArray(data) ? data : [])
						.filter((a: any) => a && a.slug)
						.map((a: any) => ({
							titre: a.titre,
							slug: a.slug,
							description_seo: a.description_seo,
							image_principale: a.Articles_id?.image_principale ?? null,
							date_publication: a.Articles_id?.date_publication ?? null,
						}));
				}
			} catch {
				articlesLies = [];
			}
		}
	} catch (error: unknown) {
		errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
	}

	const alternates: Partial<Record<Locale, string>> = {};
	if (produit?.slugs) {
		for (const [l, s] of Object.entries(produit.slugs)) alternates[l as Locale] = path(l as Locale, 'product', s as string);
	}

	return { produit, produitsSimilaires, avis, articlesLies, errorMessage, alternates, notFound: !produit && !errorMessage };
}
