import { fetchDirectus } from './directus';
import { PRODUCT_FIELDS } from './productPage';
import { getProduct, listProducts } from './content';
import { loadLinkedQuestions, type LinkedQuestion } from './questionLinks';
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
	let linkedQuestions: LinkedQuestion[] = [];
	let errorMessage: string | null = null;

	try {
		produit = await getProduct(locale, slug ?? '', PRODUCT_FIELDS);
		if (produit) linkedQuestions = await loadLinkedQuestions(locale, 'produit_lie', produit.id);

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
					`/items/Avis?filter[produit_slug][_eq]=${encodeURIComponent(produit.slugs.fr)}&filter[statut][_eq]=publie&fields=prenom,note,avis_texte,date_created&limit=50`,
				);
				avis = Array.isArray(avisData) ? avisData : [];
			} catch {
				avis = [];
			}

			// Articles liés : cherche le nom du produit (prioritaire, plus précis) puis la marque
			// (repli), dans le contenu, dans la langue de la page. Triés par date décroissante pour
			// que le contenu le plus récent/pertinent ne soit pas noyé sous d'anciens articles.
			try {
				// nom_court ("Hapo HD") plutôt que Nom_du_produit ("Hapo HD – Exosquelette dorsal…") :
				// c'est la forme sous laquelle un article mentionne réellement le produit dans son texte.
				const nameTerm = encodeURIComponent(produit.nom_court || produit.Nom_du_produit || '');
				const brandTerm = encodeURIComponent(produit.marque || '');

				const search = async (term: string, max: number) => {
					if (!term) return [] as any[];
					if (locale === 'fr') {
						const data = await fetchDirectus(
							`/items/Articles?filter[contenu][_contains]=${term}&fields=titre,slug,description_seo,image_principale,date_publication&sort=-date_publication&limit=${max}`,
						);
						return Array.isArray(data) ? data.filter((a: any) => a && a.slug) : [];
					}
					const data = await fetchDirectus(
						`/items/Articles_translations?filter[languages_code][_eq]=${locale}&filter[contenu][_contains]=${term}&fields=titre,slug,description_seo,Articles_id.image_principale,Articles_id.date_publication&sort=-Articles_id.date_publication&limit=${max}`,
					);
					return (Array.isArray(data) ? data : [])
						.filter((a: any) => a && a.slug)
						.map((a: any) => ({
							titre: a.titre,
							slug: a.slug,
							description_seo: a.description_seo,
							image_principale: a.Articles_id?.image_principale ?? null,
							date_publication: a.Articles_id?.date_publication ?? null,
						}));
				};

				articlesLies = await search(nameTerm, 3);
				if (articlesLies.length < 3 && brandTerm) {
					const seen = new Set(articlesLies.map((a: any) => a.slug));
					const more = await search(brandTerm, 3 + seen.size);
					for (const a of more) {
						if (articlesLies.length >= 3) break;
						if (!seen.has(a.slug)) { articlesLies.push(a); seen.add(a.slug); }
					}
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

	return { produit, produitsSimilaires, avis, articlesLies, linkedQuestions, errorMessage, alternates, notFound: !produit && !errorMessage };
}
